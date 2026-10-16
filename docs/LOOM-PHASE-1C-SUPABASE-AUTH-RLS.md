# LOOM — Phase 1C Implementation Report

Status: **Supabase + Authentication + PostgreSQL Schema + RLS Foundation.** Scope: cloud persistence, auth, and RLS foundation only. Nothing here implements sync, an outbox/retry engine, conflict resolution, the anonymous→account migration RPC, Debt-domain tables/logic, import/export, or a service worker — all explicitly deferred to Phase 1D+ (see §10).

---

## 1. Cloud Architecture

```text
Auth (Supabase, auth.users)
  |
  v
profiles            -- one row per authenticated user, bootstrapped by a trigger
  |
  v (no FK — ownership is membership-based, not profiles -> trackers)
trackers             -- cloud counterpart of Phase 1B's local TrackerRow
  |
  v
tracker_members      -- owner / editor / viewer, one row per (tracker, user)
```

This mirrors the two-branch architecture the brief specified — Dexie and Supabase are independent persistence destinations behind the same `TrackerRepository`/`TrackerMemberRepository` contracts (Phase 1B), with **no synchronization between them in this phase**:

```text
Anonymous:                          Authenticated (cloud POC):
UI -> hook -> DexieTrackerRepository UI -> hook -> SupabaseTrackerRepository
   -> LoomDatabase -> IndexedDB         -> Supabase client -> PostgreSQL
```

`/trackers/debt` (Phase 1B) is untouched and still Dexie-only. The cloud path is a *separate* proof surface on `/account`, signed-in only — not a second Debt Tracker, not a redesign of the local one.

---

## 2. Database Schema

Single migration: `supabase/migrations/20260909070434_platform_schema.sql`.

### profiles
```text
id            uuid primary key references auth.users(id) on delete cascade
display_name  text
created_at    timestamptz default now()
updated_at    timestamptz  (trigger-maintained)
```
Bootstrapped by `handle_new_user()`, a trigger on `auth.users` insert (`SECURITY DEFINER`, `search_path=''`) — there is no INSERT policy at all, so no authenticated user can create a profile row (their own or anyone else's) directly.

### trackers
```text
id            text primary key   -- client-generated ULID (D-002), NOT a Postgres-generated uuid/serial
template_key  text not null
name          text not null
settings      jsonb not null default '{}'  -- opaque per-template blob (Phase 1B decision, unchanged)
archived_at   timestamptz
created_at    timestamptz default now()    -- database-generated, see §Timestamps
updated_at    timestamptz                  -- trigger-maintained
```
Constraints: `id`/tracker_members.id must match the ULID pattern (`^[0-9A-HJKMNP-TV-Z]{26}$`); `template_key`/`name` must not be blank. **No owner/user_id column** — ownership is entirely derived from `tracker_members`, per Phase 0's D-006/D-007. Indexes on `template_key`, `archived_at`, `created_at` (mirrors the Dexie schema's indexes exactly).

### tracker_members
```text
id          text primary key   -- client-generated ULID
tracker_id  text references trackers(id) on delete cascade
user_id     uuid references auth.users(id) on delete cascade
role        text check (role in ('owner','editor','viewer'))
created_at  timestamptz default now()
updated_at  timestamptz  (trigger-maintained)
unique (tracker_id, user_id)
```
`tracker_members_one_owner_idx`: a **unique partial index** (`... where role = 'owner'`) enforces exactly one owner per tracker at the database level — not merely by RPC/application convention. Deleting a tracker cascades to its own membership rows (there's nothing meaningful left to keep); deleting a user cascades to *their* membership rows only — a tracker a deleted user owned is **not** auto-deleted (see Known Limitations, §9).

### Timestamps
A deliberate client/server split, different from Phase 1B: `created_at`/`updated_at` are **database-generated** here (`DEFAULT now()` / a `BEFORE UPDATE` trigger that unconditionally overwrites `updated_at`, ignoring anything the client sends) — a real server clock is available now, so there's no reason to trust the client for audit-relevant timestamps the way Phase 1B had to. `archived_at` stays application-set (mirroring the local `archive()`/`restore()` shape) since it's ordinary app state, not audit metadata.

### create_tracker() — the only way a tracker is ever created
```sql
create_tracker(p_tracker_id text, p_member_id text, p_template_key text, p_name text, p_settings jsonb)
  returns trackers
```
`SECURITY DEFINER`, `search_path=''`. There is **no INSERT policy on `trackers` at all** — direct `insert into trackers` from any authenticated client is denied by RLS with no matching policy, full stop. This function:
1. Requires `auth.uid()` is not null (raises `28000` otherwise).
2. Validates both ids are well-formed ULIDs and template_key/name aren't blank (raises `22023` otherwise).
3. Inserts the tracker row.
4. Inserts the owner membership row with `user_id = auth.uid()` — **there is no owner-id parameter at all**, so "create this tracker for user X" isn't an expressible client request, not merely a validated-against one.

Both inserts happen inside one PL/pgSQL function body, which PostgreSQL already runs as a single atomic unit — no explicit transaction block was needed for the atomicity requirement.

---

## 3. RLS Matrix

| Operation | Owner | Editor | Viewer | Unrelated authenticated | Anonymous |
|---|---|---|---|---|---|
| Read tracker | ✅ | ✅ | ✅ | ❌ (0 rows) | ❌ (permission denied — no grant) |
| Update tracker (name/settings) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Archive / restore (D-006) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Permanently delete tracker | ✅ | ❌ | ❌ | ❌ | ❌ |
| Read membership | ✅ | ✅ | ✅ | ❌ | ❌ |
| Insert membership (add editor/viewer) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Insert membership as owner (any role) | ❌ (blocked even for the owner — only `create_tracker()`'s internal bypass can) | ❌ | ❌ | ❌ | ❌ |
| Update membership role (editor⇄viewer only) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update *own* role / promote to owner | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete membership (non-owner row) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete the owner's own membership row | ❌ (no self-orphaning) | — | — | — | — |

Every cell above is asserted by an actual executed query in `tests/db/rls.test.ts` against real PostgreSQL — see §7.

**Why denial looks like not-found.** An unauthorized read/update/delete returns *zero rows*, not a distinct "forbidden" error — this is standard PostgreSQL RLS behavior (rows the policy hides simply aren't there from the caller's point of view) and is deliberately preserved rather than worked around: it means a tracker's mere *existence* is never leaked to someone who isn't a member, matching the direct-ID-attack requirement (§29 of the brief). The local Dexie repository already behaves the same way (`PersistenceNotFoundError` for both "doesn't exist" and, hypothetically, "not yours").

---

## 4. Authentication

**Method: passwordless magic link (email OTP)** via `supabase.auth.signInWithOtp()`. Chosen over a password form because: nothing to hash/store/leak, no password-reset flow to build, and it fits a public-first app where an account is a pure enhancement — the friction of "check your email" only has to be paid by someone who actually wants cloud backup.

- **Sign in**: `SignInForm` (`components/account/sign-in-form.tsx`) collects an email, calls `useSession().signInWithOtp(email)`, shows a "check your email" confirmation. The link's `emailRedirectTo` points at `/auth/callback`.
- **Callback**: `app/auth/callback/route.ts` exchanges the one-time `code` for a real session (PKCE flow, via `createSupabaseServerClient().auth.exchangeCodeForSession`) and redirects to `/account`. It never gates any other route.
- **Session handling**: `proxy.ts` (Next.js 16's renamed `middleware.ts` convention) calls `updateSupabaseSession()` on every request to refresh the auth cookie — this is upkeep only, it never redirects or blocks; it's a complete no-op (no Supabase client even constructed) when Supabase isn't configured.
- **Sign out**: `useSession().signOut()` calls `supabase.auth.signOut()` client-side.
- **Profile provisioning**: automatic, via the `handle_new_user()` database trigger (§2) — the client never creates its own profile row.
- **`useSession()`** (`lib/auth/hooks/use-session.ts`) is the one seam UI components use to read/react to auth state — four states: `"unconfigured"` (no Supabase project linked in this environment — a distinct, honestly-reported state, not a silent failure), `"loading"`, `"signed-out"`, `"signed-in"` (carries the Supabase `User` plus the `profiles` row).

---

## 5. Repository Architecture

```text
TrackerRepository (interface, Phase 1B)
    +-- DexieTrackerRepository        (lib/persistence/repositories/, unchanged)
    +-- SupabaseTrackerRepository     (lib/persistence/cloud/, new)

TrackerMemberRepository (interface, Phase 1B)
    +-- DexieTrackerMemberRepository  (unchanged)
    +-- SupabaseTrackerMemberRepository (new)
```

`SupabaseTrackerRepository` implements the *exact same* `TrackerRepository` contract Phase 1B defined — `create/getById/list/update/archive/restore/deletePermanently` — so a hook (and anything above it) never needs to know which backend it's talking to beyond choosing which hook to call. `create()` always goes through the `create_tracker` RPC, never a direct `.insert()`. Every failure funnels through `wrapSupabaseError()` (`lib/persistence/cloud/errors.ts`) into the same small `PersistenceError` vocabulary Phase 1B established, extended with four new subclasses genuinely needed for a cloud backend: `PersistenceUnauthenticatedError`, `PersistenceAuthorizationError`, `PersistenceNetworkError`, `PersistenceValidationError` — no parallel error hierarchy was created.

`lib/persistence/cloud/index.ts` is the one barrel application code should import for cloud persistence (mirroring `lib/persistence/index.ts` for local) — it hides the Supabase client and concrete repository classes, and throws `PersistenceUnavailableError` (the same type Phase 1B uses for "IndexedDB unavailable") when no Supabase project is configured.

**No UI component imports Supabase directly** — verified by grep; the only non-`lib/*` file importing `@supabase/*` is `app/auth/callback/route.ts`, a server-only Route Handler, not a component.

---

## 6. Supabase Client Architecture (`lib/supabase/`)

- `env.ts` — `isSupabaseConfigured()` (checked everywhere before touching Supabase) plus `getSupabaseUrl()`/`getSupabaseAnonKey()`, which throw only once that check has already passed.
- `client.ts` — the one browser client, `"use client"`-only, returns `null` when unconfigured instead of throwing.
- `server.ts` — `import "server-only"` guarantees this (and anything importing it) can never enter a client bundle; a fresh client per request, per Supabase's own guidance.
- `middleware.ts` — `updateSupabaseSession()`, the session-refresh logic `proxy.ts` calls.
- `database.types.ts` — see §Types below.

Both clients use **only the anon/publishable key** — never the service_role/secret key. A security-review grep (`service_role|SERVICE_ROLE|SUPABASE_SECRET|secretKey`) across `lib/`, `app/`, `components/`, `.env.local.example`, and `proxy.ts` found zero matches outside comments explicitly warning against it.

### Types
The normal path is `supabase gen types typescript --linked` (or `--db-url`) so types are mechanically derived from the live schema. Both require **Docker** (the CLI's local/db-url type generation shells out to a Docker-based introspection container) — confirmed unavailable in this environment (Docker Desktop's binaries are missing; `docker version` fails). `database.types.ts` is therefore **hand-authored**, kept in exact lockstep with the one migration file, with a comment pointing at the real command to run and replace it wholesale once Docker or a linked project is available.

### Environment
See `.env.local.example`. Two browser-safe variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`); `.gitignore`'s existing `.env*` rule is preserved with one explicit exception (`!.env.local.example`) so the template itself can still be committed. **LOOM runs fully with neither set** — every anonymous/local page works with zero configuration, which is the actual state of this environment right now (no live Supabase project or credentials were available while building this phase — see §8).

---

## 7. Security Testing — What Was Actually Executed

The brief was explicit: *"Do not report 'RLS verified' because policies compile successfully."* Two levels of testing exist, with a precisely stated boundary between them.

### Real PostgreSQL RLS tests (`tests/db/rls.test.ts`, `npm run test:db`)
A genuine, disposable PostgreSQL 18.4 instance is booted via `embedded-postgres` (a real `postgres.exe`/`initdb.exe`, not Docker, not a mock — confirmed working natively on Windows) for every test run. The exact, unmodified SQL from `supabase/migrations/` is applied against it, plus `tests/db/auth-stub.sql` — a test-only stand-in reproducing the slice of a real Supabase project's `auth` schema these policies depend on (`auth.users`, `auth.uid()` reproduced verbatim from Supabase's own public/documented implementation, and the `anon`/`authenticated` Postgres roles). **40 adversarial scenarios**, each executing a real SQL statement and asserting the real result:

- Profile isolation: own profile read/update; cross-user read/update denied; anonymous denied entirely; direct-insert bootstrap bypass denied.
- Owner: create via RPC, read, update own tracker; recorded as `role='owner'` in `tracker_members`.
- Cross-user denial (direct-ID attacks): unrelated user cannot read/update/archive/delete a tracker, insert/modify its membership, or self-promote to owner — all against a tracker whose real ULID the "attacker" is handed directly, proving denial isn't obscurity.
- Anonymous: denied on trackers/profiles/membership (denied at the *grant* level — no `GRANT ... TO anon` exists at all — which is a harder guarantee than an RLS-filtered empty result).
- Forged ownership: direct `insert into trackers` denied outright (no INSERT policy exists); `create_tracker()` proven to always use the caller's own `auth.uid()` (no owner-id parameter exists to forge in the first place); an unauthenticated RPC call is rejected.
- Viewer: read-only, confirmed cannot update/archive/delete/insert-membership/escalate own role.
- Editor: can update + archive/restore (D-006), confirmed cannot permanently delete, cannot escalate own role, cannot touch another member's role, cannot insert membership.
- Owner membership management: can add editor/viewer, reassign editor⇄viewer; confirmed cannot promote anyone to owner via update, cannot insert a second owner row (both the policy *and* the unique partial index independently reject it), cannot delete their own owner row, can remove a non-owner member; duplicate membership for the same (tracker, user) rejected by the unique constraint.
- Tracker isolation: a viewer of tracker A has zero visibility into tracker B, even though the same user owns both.

One real bug was **found and fixed** by this suite, not by inspection: the first draft of the `tracker_members` policies queried `tracker_members` from within their own `USING`/`WITH CHECK` clauses, which triggers PostgreSQL to re-apply the table's own SELECT policy to evaluate that inner query — an infinite recursion ("infinite recursion detected in policy for relation tracker_members"). Fixed with the standard, documented pattern: a `SECURITY DEFINER` helper function (`my_tracker_role()`) that bypasses RLS for its own internal lookup, breaking the cycle. This is exactly the class of bug "policies compile" would have missed entirely.

### What this does and doesn't prove
**Proves**: the RLS policy logic itself, under real PostgreSQL role/JWT-claim semantics identical to how PostgREST scopes a request (`SET ROLE anon|authenticated` + `request.jwt.claims` — the same mechanism Supabase's own GoTrue/PostgREST stack uses). A genuinely unauthorized query is genuinely rejected by the database.

**Does NOT prove**: GoTrue's actual auth flows (magic-link issuance/verification, session/cookie handling), PostgREST's HTTP layer, or the Supabase client SDK's network behavior — none of that can be exercised without either Docker (for `supabase start`, unavailable here — confirmed, `com.docker.service` present but stopped and the CLI binaries missing) or a live hosted Supabase project (no credentials available in this environment). The application-layer code that talks to those pieces (`lib/supabase/*`, `lib/auth/*`) is verified by: (a) unit tests against a hand-rolled query-builder double for the repository *logic* (request shaping, response mapping, error wrapping — `tests/unit/persistence/cloud-*.test.ts`, 18 tests), and (b) an e2e test proving the account page degrades honestly with zero credentials configured (`e2e/account.spec.ts`), which is the actual, real state of this environment. **No sign-in flow, no session cookie refresh, and no live cloud tracker CRUD have been exercised end-to-end against a real Supabase project.** That remains untested until real credentials exist — see §9.

---

## 8. Environment Constraints Encountered (and how they were handled)

- **No Docker**: `docker` isn't on PATH; Docker Desktop's service (`com.docker.service`) exists but is stopped and its binaries are missing. This rules out `supabase start` (the full local GoTrue+PostgREST+Postgres stack) and `supabase gen types --db-url`/`--linked` (both shell out to a Docker-based step). Handled by: `embedded-postgres` (a real, Docker-free PostgreSQL binary) for RLS testing, and hand-authored types with a documented regeneration path for when Docker/a linked project becomes available.
- **No live Supabase project or credentials**: none were provided or created in this environment. Handled by: every Supabase-dependent code path degrades to an honest `"unconfigured"`/`PersistenceUnavailableError` state rather than crashing, verified by `e2e/account.spec.ts` and the production build succeeding with zero env vars set.
- **npm script-allowlist policy** (recurring from Phases 1A/1B): `@embedded-postgres/windows-x64`'s postinstall script was blocked; inspected and confirmed to be a no-op for this platform build (an empty `pg-symlinks.json` — the Windows binaries ship flat, nothing to re-link) rather than bypassed blindly.

---

## 9. Known Limitations

- **No live end-to-end auth/cloud test exists** (see §7's boundary statement) — this is the most significant gap and the reason this phase is not classified as an unconditional PASS.
- **`database.types.ts` is hand-authored**, not CLI-generated (Docker unavailable) — must be manually kept in sync with the one migration file; low risk today (one migration, three tables) but should be replaced with generated types at the first opportunity.
- **A tracker survives its owner's account deletion** — `tracker_members` cascades away (the now-nonexistent user's membership row is gone) but the `trackers` row itself has no FK to any user, so it becomes ownerless rather than being deleted. This is a deliberate choice (see §2, "Delete semantics") to avoid ever cascading away a tracker's data automatically — it does mean an ownerless tracker is currently unreadable by anyone (no member exists) and has no recovery path; that path (support intervention, an ownership-transfer feature, or an intentional cascade) is unbuilt and belongs to a future phase.
- **No rate limiting on `signInWithOtp`** beyond whatever Supabase Auth applies by default — not configured or tuned in this phase.
- **The pre-existing `StatusBadge` "success"-tone contrast issue** (Phase 1B, WCAG 2 AA color-contrast) still exists — re-confirmed still present, still out of this phase's scope (see Phase 1B's report, §9), not touched here.
- **Ownership transfer is not implemented** (deliberately — see §15 of the brief); the schema/RLS structurally prevent it rather than merely lacking a UI for it.

---

## 10. Deferred Work (explicitly NOT built in this phase)

- Sync engine: outbox, retry logic, conflict resolution, last-write-wins
- Anonymous → authenticated migration RPC/flow
- Background sync, offline mutation replay
- Real Debt Tracker domain logic and tables
- CSV/XLSX/PDF import or export
- Service worker / full offline support
- Supabase Realtime / live collaboration
- Ownership transfer
- A live, credentialed end-to-end test of the auth/cloud path (§9)
- CLI-generated database types (§9)

---

## 11. Phase 1D Readiness Check

| Precondition | Status |
|---|---|
| Local IDs are stable | ✅ ULID, unchanged since Phase 1B |
| Cloud IDs are compatible | ✅ `trackers.id`/`tracker_members.id` are the *same* client-generated ULID type/value space as Dexie's — no ID-rewrite step needed for a future migration |
| Authenticated identity is reliable | ⚠️ Reliable *in the RLS model* (proven); the live GoTrue session/cookie path is unverified end-to-end (§9) |
| Tracker membership is authoritative | ✅ Ownership only ever comes from `tracker_members`, never a `user_id` column, on both backends |
| RLS is proven | ✅ 40 real adversarial PostgreSQL tests, not policy inspection |
| Owner/editor/viewer semantics are proven | ✅ Full matrix in §3, each cell backed by an executed test |
| Repository boundary supports local/cloud implementations | ✅ Both implement the identical `TrackerRepository`/`TrackerMemberRepository` contracts |
| Cloud schema is stable enough for sync | ✅ One migration, additive-only versioning convention already established (Phase 1B pattern, same discipline applies here) |
| Timestamps are coherent | ✅ Documented client/server split (§2); both sides use ISO-8601/timestamptz consistently |
| Archived state is understood | ✅ Same soft-delete (archive) vs. hard-delete (permanent) split on both backends, per D-006 |
| Duplicate creation can be detected/reconciled later | ✅ Same ULID used on both sides means a future sync engine can key on `id` directly, no reconciliation heuristic needed for the common case |
| Migration can eventually be transactional | ✅ `create_tracker()` already demonstrates the pattern (single PL/pgSQL function, atomic); a future migration RPC can follow the same shape |
| No current architecture prevents anonymous → authenticated migration | ✅ Nothing here assumes a tracker was always cloud-backed or always local — the two repositories are structurally interchangeable behind one interface |

**Overall**: the architecture is ready for Phase 1D's *design* work. The one real gap is empirical, not architectural: nothing in the cloud path has been exercised against a live Supabase project. Phase 1D (or a short bridging step before it) should budget time to provision a real project, run the migration for real, and re-verify sign-in + cloud CRUD end-to-end before building sync logic on top of an unverified live foundation.

---

## 12. Testing Summary

| Suite | Command | Count |
|---|---|---|
| Real PostgreSQL RLS tests | `npm run test:db` | 40/40 |
| Unit (cloud repository + error mapping, new) | `npm run test` | 18 new (67/67 total incl. Phase 1B) |
| Component/e2e (regression, Phase 1A/1B) | `npm run test:e2e` | unchanged, still passing |
| e2e (new: account page unconfigured state) | `npm run test:e2e` | 4 new |
| e2e (full suite) | `npm run test:e2e` | 42/42 |
| Accessibility (axe, regression) | part of `test:e2e` | 10/10, unchanged |

See the final report (delivered in-conversation) for the fully executed validation matrix with exact commands and results.
