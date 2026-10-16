# LOOM — Platform Architecture (Phase 0)

Status: **Specification — not yet implemented.** No application code, migrations, or dependencies exist yet. Working directory `D:\loom` was empty and is not a git repository at the time of this document.

---

## 1. Environment Findings

| Item | Result |
|---|---|
| Directory | `D:\loom`, empty (no files) |
| Git repository | Not initialized |
| OS | Windows 11 Pro |
| Node.js | v24.16.0 (available) |
| npm | 12.0.2 (available) |
| pnpm | not installed |
| yarn | not installed |
| Git | 2.54.0.windows.1 (available) |
| Supabase project | none provisioned |
| Existing config | none |

This is a greenfield start. Package manager choice (npm vs pnpm) is an open decision (see Open Decisions doc) since only npm is currently installed.

---

## 2. Technology Stack Evaluation

### 2.1 Frontend: Next.js + React + TypeScript — **Accept**

- App Router gives a clean split between server-rendered public/marketing routes (homepage, tracker gallery, help) and client-rendered interactive tracker workspaces (which need `IndexedDB`, so must be `'use client'`).
- TypeScript is required for a system with shared zod schemas between local persistence, sync payloads, and Supabase rows — this is a correctness-critical app (money math), not a place to skip types.
- Risk: it's easy to default everything to client components. Mitigate by keeping marketing/discovery routes server-rendered and only crossing to client at the tracker-workspace boundary (see Performance, §12).

### 2.2 UI: Tailwind CSS + shadcn/ui + custom LOOM design system — **Accept**

- shadcn/ui is built on Radix primitives, which gives accessible dialogs/bottom sheets/menus for free — important since Phase 0 mandates real accessibility, not an afterthought.
- Tailwind fits the "premium but practical" visual direction (tokens via CSS variables, dark mode, glass/gradient utility classes) without a heavyweight CSS-in-JS runtime cost on mobile.
- Custom LOOM layer sits on top as tokens + a small set of composed components (StatTile, SyncStatusChip, BottomSheet wrapper), not a fork of shadcn internals.

### 2.3 Backend: Supabase (Postgres + Auth + Storage) — **Accept**

- Fits "optional authentication": Supabase Auth supports anonymous usage patterns cleanly (no session created until sign-up), and Postgres RLS gives per-row authorization that naturally extends to shared trackers (`tracker_members`) without bespoke auth middleware.
- Alternative considered: a custom Node/Express + Prisma backend. Rejected — it would require hand-building auth, RLS-equivalent authorization, and hosting, all of which Supabase provides with less operational surface for a small team.
- Risk: RLS correctness is now a first-class engineering task (see §7–8). A leaked service-role key or a missing policy is a real data-exposure risk. This must be tested (see Testing Strategy).

### 2.4 Local persistence: IndexedDB — **Accept, with a refinement**

- Raw IndexedDB is low-level (no query engine, awkward transactions, manual schema migration). Recommend **Dexie.js** as the access layer: typed tables, versioned schema migrations, and transaction ergonomics that a sync engine actually needs.
- This is a stack refinement, not a rejection of IndexedDB itself — Dexie is a thin wrapper over the same browser API.

### 2.5 Authentication: Optional — **Accept**

- Core to the product model (§4 in Debt Tracker spec / Product Model below). Anonymous users get full local functionality; auth is an upgrade path, not a gate.

### 2.6 PWA — **Accept, with a library change**

- `next-pwa` (the commonly-suggested package) is effectively unmaintained. Recommend **Serwist** (its maintained successor, purpose-built for Next.js App Router) for service worker generation and Workbox-based caching strategies.
- Local-first ≠ "fully offline app shell" out of the box — this must be validated empirically once implemented, not promised outright (per instructions, this doc avoids over-promising).

### 2.7 Export: CSV / XLSX / PDF — **Accept, with concrete library picks**

- CSV: no dependency needed for export (simple string join); **PapaParse** for import parsing.
- XLSX: recommend **ExcelJS** (clean license, multi-sheet + styling support, works client-side) over raw SheetJS-community for long-term maintainability.
- PDF: recommend **@react-pdf/renderer** — component-driven, works client-side (fits local-first, no server round trip required to export a tracker that only exists locally).

### 2.8 Import: CSV now, XLSX later — **Accept**

- CSV via PapaParse is sufficient for MVP. XLSX import deferred; when added, reuse the same mapping/validation/preview pipeline (§Import Engine), swapping only the parser.

### 2.9 Summary of stack changes vs. the original proposal

| Area | Original | Recommended | Reason |
|---|---|---|---|
| IndexedDB access | raw IndexedDB | Dexie.js | schema versioning + transactions needed for sync engine |
| PWA tooling | (unspecified) | Serwist, not next-pwa | next-pwa is unmaintained |
| XLSX | (unspecified) | ExcelJS | license + multi-sheet ergonomics |
| PDF | (unspecified) | @react-pdf/renderer | client-side generation fits local-first |
| ID strategy | (unspecified) | ULID (client-generatable, time-sortable) | needed for offline-created records, see §5 |
| Validation | (unspecified) | zod, shared between client/server | one schema source of truth for local, sync, and API validation |

Everything else in the proposed stack is accepted as-is.

---

## 3. LOOM Product Model

### 3.1 Tracker Template
A **code-level registration**, not a database-driven CMS entry (see §9, over-abstraction guardrail). A `TrackerDefinition` describes: key, label, category (Money/Business/Productivity), icon, local schema (Dexie tables), remote schema (Supabase tables it owns), derived calculations, dashboard/detail components, and export/import configuration. New tracker types ship as code (a new module + registry entry), not as admin-configured metadata — this keeps the MVP simple and avoids building a no-code form engine nobody asked for.

### 3.2 Tracker Instance
A row in `trackers`: a concrete tracker a user created ("My Credit Card Debt"). Has a `template_key`, `name`, optional `owner_id` (null while local-only/anonymous), `settings jsonb`, timestamps, `archived_at`.

### 3.3 Tracker Member
Modeled from day one as `tracker_members(tracker_id, user_id, role)` even though the Debt Tracker MVP only ever has one member (the owner). This is the mechanism that makes Couple Budget Tracker (and any future shared tracker) possible **without** redesigning the ownership model later. `tracker.user_id` alone is explicitly rejected as the sole ownership model.

Roles: `owner` (full control incl. membership/deletion), `editor` (read/write domain records), `viewer` (read-only). MVP only ever creates `owner` rows; the enum and table exist so a future "invite" feature is additive, not a migration that touches every domain table's RLS.

### 3.4 Tracker Settings
Folded into `trackers.settings jsonb` rather than a separate `tracker_settings` table for MVP. A dedicated table is only justified if settings need independent RLS or row-level versioning — they don't yet. This is intentionally the simpler choice (§9/§10 over-abstraction guardrail); split it out later if a concrete need appears.

---

## 4. Public-First User Experience

```
Visitor → LOOM homepage → choose tracker template → tracker created LOCALLY (IndexedDB, no network call)
   → user enters data → autosaved locally on every change
   → (optional) exports data anytime
   → (optional) creates account → local tracker migrates to Supabase → continues seamlessly
```

State matrix:

| State | Behavior |
|---|---|
| Anonymous, online | Tracker is local-only; UI shows "Saved on this device"; no network required for core loop |
| Anonymous, offline | Identical — local-first means offline is not a degraded mode for anonymous users, it's the default mode |
| Browser refresh | IndexedDB persists; app rehydrates from local DB on load, no data loss |
| Browser restart | Same — IndexedDB survives browser restarts (not private/incognito sessions, which is a documented limitation, see Open Decisions) |
| Sign-up mid-session | Local tracker(s) migrate to Supabase (§5.4); local data is retained as the local cache, not deleted |
| Registered, online | Tracker is cloud-backed; local write happens first, then background sync |
| Registered, offline | Writes queue locally (outbox), sync resumes automatically on reconnect |
| Registered, new device | Cloud hydration: tracker list + records fetched from Supabase into a fresh local IndexedDB cache |

No screen requires sign-in to be useful. Sign-in is offered contextually ("Create a free account to back this up and access it on other devices") after the user already has something to lose — this is a UX decision, not just a technical one.

---

## 5. Local-First Architecture

### 5.1 IDs

- Every record (tracker, debt, payment, adjustment) gets a client-generated **ULID** as its canonical `id`, generated at creation time — online or offline, authenticated or not.
- The server never generates the canonical ID. This is what makes offline creation and idempotent sync possible: the client already knows the record's permanent ID before any network call happens.
- Supabase tables use this same ULID as their primary key (stored as `text` or `uuid`-compatible depending on final type choice — see Open Decisions). There is no separate "local id vs server id" split to reconcile — one ID, assigned once, by the client.

### 5.2 Local database structure (Dexie/IndexedDB)

Per browser, one Dexie database for the whole app. Tables mirror the domain tables that exist in Supabase (`trackers`, `debts`, `debt_payments`, `debt_adjustments`, plus a platform `sync_outbox` table). Every domain record carries platform-level fields in addition to its domain fields:

| Field | Purpose |
|---|---|
| `id` | canonical ULID |
| `tracker_id` | owning tracker |
| `updated_at` | client clock, bumped on every local mutation |
| `deleted_at` | soft-delete tombstone (nullable) |
| `sync_status` | `local_only` \| `pending` \| `synced` \| `conflict` \| `error` |
| `server_updated_at` | last known server timestamp, set after successful sync — used for conflict detection |

### 5.3 Persistence / repository layer

```
UI action
  → TrackerRepository.write(record)
      → LocalStore.write(record)          [always, synchronous-feeling, immediate]
      → if tracker.owner_id is set:
          SyncOutbox.enqueue(operation)    [fire-and-forget from the UI's perspective]
```

- `TrackerRepository` is the only interface UI code talks to. It never calls Supabase directly.
- `LocalStore` wraps Dexie. `SyncEngine` owns the outbox and all network I/O. UI code is oblivious to whether a tracker is cloud-backed — it always reads from and writes to local first, so the UI never blocks on network latency.

### 5.4 Sync engine

- **Outbox**: an append-only queue of operations (`create` \| `update` \| `delete`, table, record id, payload, attempt count, last error, created_at). Persisted in IndexedDB so it survives a closed tab.
- **Idempotency**: every write to Supabase is an `upsert` keyed on the record's own ULID `id` (which is the primary key). Retrying a failed sync attempt is always safe — same ID, same payload, no duplicate.
- **Ordering**: operations for a given record are applied in queue order per tracker; cross-tracker operations may run concurrently.
- **Retry**: exponential backoff on network failure; operations stay `pending` and are retried on reconnect (`online` event) or next app open.
- **Conflict detection**: on sync, compare the outgoing record's basis (`server_updated_at` it was last synced from) against the current server row's `updated_at`. If the server row changed since the client's basis *and* the client also has local changes, it's a conflict.
- **Conflict resolution (MVP)**: last-write-wins at the record level, with the loser's version kept in `sync_status='conflict'` locally (not silently discarded) so the platform *could* surface a "this was overwritten, review?" affordance later. This is deliberately simple: MVP debt tracking is single-owner, so real conflicts are rare (only concurrent edits from two devices of the same user). True multi-user conflict merging is deferred until shared trackers (Couple Budget) actually ship — see Open Decisions.
- Payments/adjustments are modeled as an **append-heavy ledger** rather than mutable aggregate fields specifically because ledgers are close to conflict-free (new rows don't conflict with each other); this is a deliberate design choice to keep the conflict surface small without building a CRDT.

### 5.5 Anonymous → account migration (critical path)

```
1. User signs up / logs in.
2. Client scans local Dexie DB for trackers with owner_id = null.
3. For each such tracker (once, guarded by a locally-stored client_migration_id per tracker
   so a retried/interrupted migration cannot run twice):
     a. Client calls a single Postgres RPC `migrate_tracker(payload jsonb)` containing the
        tracker + all its child records (already carrying their canonical ULIDs).
     b. The RPC runs in ONE transaction:
          - upsert tracker row (owner_id = auth.uid()), keyed by tracker's own id
          - insert tracker_members row (role='owner'), idempotent (ON CONFLICT DO NOTHING)
          - upsert every child record keyed by its own id
     c. RPC returns confirmed row counts.
4. Client compares confirmed counts to what it sent. Only on full match does it mark the
   tracker + all children sync_status='synced' locally and set owner_id.
5. Local IndexedDB data is NOT deleted — it becomes the ongoing local cache for that
   now-cloud-backed tracker.
```

Because every record already has its permanent ID before migration starts, the upsert-by-id pattern makes retries, dropped connections, and app restarts mid-migration safe: re-running the same RPC with the same payload converges to the same end state, never duplicates.

### 5.6 Cloud hydration (new device / re-login)

On sign-in on a device with no local cache for a tracker: fetch `trackers` the user is a member of, then fetch each tracker's domain records, and populate Dexie from scratch, marking everything `sync_status='synced'`. This is a pull-only bootstrap, no merge logic needed since local is empty.

### 5.7 Multi-device sync

Out of scope for real-time collaboration in MVP (no live cursors, no realtime presence). "Multi-device" for MVP means: open the app on device B, get the current server state on load, then behave like any other online client (write-local-then-sync). Supabase Realtime subscriptions are a natural future upgrade (push updates from device A to an open tab on device B) but are **not** required for the MVP to be correct — polling/on-load hydration is sufficient and simpler.

---

## 6. Sync State UX

Persistent, low-noise status indicator (a small chip near the tracker name), not a toast per event:

| State | Shown as |
|---|---|
| Local-only (no account) | "Saved on this device" (neutral icon) |
| Saving (in-flight local write) | brief inline spinner on the field/action itself, not global |
| Synced | small cloud-check icon, subtle, static |
| Syncing | cloud icon with a subtle spin, only shown if it takes >~1s |
| Offline | small "Offline" badge; explicitly reassures: "Your changes are saved and will sync when you're back online" |
| Sync failed | badge becomes tappable → shows retry action + plain-language reason |

Design rule: never block an interaction on sync state. The chip informs; it never gates.

---

## 7. Supabase Architecture

### 7.1 Conceptual tables

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`, display name, preferences |
| `trackers` | tracker instances; `id` (ULID/uuid), `template_key`, `name`, `owner_id`, `settings jsonb`, `archived_at`, `created_at`, `updated_at` |
| `tracker_members` | `(tracker_id, user_id, role)`, membership + role |
| `debts` | Debt Tracker domain table, `tracker_id` FK |
| `debt_payments` | `tracker_id`, `debt_id` FK |
| `debt_adjustments` | `tracker_id`, `debt_id` FK |

No separate `tracker_settings` table (see §3.4). No admin-facing `tracker_templates` table — templates are code.

### 7.2 Authentication
Supabase Auth (email/password + optionally magic link / OAuth later). No forced session for anonymous use — the anonymous experience never touches Supabase at all until migration.

### 7.3 Storage
Not required for MVP Debt Tracker (no file uploads). Anticipate future use (e.g., attaching a receipt image to a payment) but do not build it now.

---

## 8. Database Ownership + RLS

Authorization model: **every domain record's access is derived from its parent tracker's membership**, never from a `user_id` column duplicated onto every table.

```
tracker  →  tracker_members (role)  →  debts  →  debt_payments / debt_adjustments
```

RLS pattern (conceptual, not final SQL):

- A security-definer helper function `is_tracker_member(tracker_id, min_role)` checks `tracker_members` for the current `auth.uid()` and role rank ≥ `min_role`. Using a function (rather than inlining the join in every policy) avoids RLS recursion pitfalls and keeps every table's policy identical in shape.
- `trackers`: SELECT/UPDATE if member; INSERT allowed for the authenticated user (becomes owner via a trigger/RPC that also inserts the `tracker_members` row atomically); DELETE only if `role = 'owner'`.
- `tracker_members`: SELECT if you're a member of that tracker; INSERT/UPDATE/DELETE only if `role = 'owner'` (prevents an editor from promoting themselves).
- `debts`, `debt_payments`, `debt_adjustments`: SELECT if `is_tracker_member(tracker_id, 'viewer')`; INSERT/UPDATE if `is_tracker_member(tracker_id, 'editor')`; DELETE if `is_tracker_member(tracker_id, 'editor')` (soft-delete in practice, see Debt spec) or restricted to `owner` — to be finalized in implementation, leaning toward editor-can-archive / owner-can-hard-delete.

Security risks to track explicitly during implementation:
- RLS policies must be tested with an authenticated non-member user attempting cross-tracker access (this must be a real test, not assumed).
- The Supabase service-role key must never reach client bundles; any server-side privileged operation (e.g., account deletion cascade) goes through an Edge Function or RPC, not client code.
- `migrate_tracker` RPC must itself verify `auth.uid()` matches the session and cannot be called to claim someone else's local payload as your own tracker (the payload is client-authored but ownership is always set server-side from the session, never trusted from the payload).

---

## 9. The Tracker Engine

### 9.1 Platform capabilities (reusable, engine-owned)

- Tracker CRUD shell (create/rename/archive/delete a tracker instance) and routing
- Tracker membership + roles
- Settings storage (`jsonb`, typed per-template via zod at the UI layer)
- Persistence abstraction (`TrackerRepository`, `LocalStore`, `SyncEngine`, outbox)
- Export Engine (CSV/XLSX/PDF writers, fed tracker-specific data)
- Import Engine (parse/map/validate/preview/commit pipeline, fed tracker-specific field mapping)
- Auth (sign-up/sign-in, session, anonymous→account migration flow)
- Navigation/app shell, bottom nav, category browsing
- Generic UI states: loading, empty, error, offline, confirmation dialogs
- Activity/history log primitive (a generic append-only `event` concept a tracker can write human-readable entries to)
- PWA shell (service worker, manifest, install prompt, update banner)

### 9.2 Tracker-specific domain logic (owned by each tracker module)

- Domain schema (zod) and Supabase tables for that tracker type
- Business calculations (Debt: balance/progress/payoff math; Inventory: stock levels; Tasks: completion state)
- Dashboard and detail UI
- Export column/sheet/section configuration (what a CSV row / XLSX sheet / PDF section looks like for *this* tracker)
- Import field mapping defaults for *this* tracker's schema
- Domain-specific validation rules

### 9.3 Registration contract

A `TrackerDefinition` (code object) is how a tracker plugs into the engine:

```ts
{
  key: 'debt',
  label: 'Debt Tracker',
  category: 'money',
  icon: ...,
  localTables: [...Dexie table schemas...],
  remoteTables: [...Supabase table names this owns...],
  calculations: { deriveBalance, deriveProgress, ... },
  DashboardComponent, DetailComponent, CreateForm, RecordEntryForm,
  exportConfig: { toCsvRows, toXlsxSheets, toPdfSections },
  importConfig: { defaultFieldMap, rowValidator },
}
```

This is the entire seam. Adding Inventory or Tasks later means writing a new module conforming to this shape and adding one line to the registry — not touching persistence, sync, auth, export writers, or navigation.

---

## 10. Preventing Over-Abstraction

Explicitly rejected as premature:

- A generic "field builder" / no-code schema editor for defining tracker types at runtime. Tracker types are code.
- An EAV (entity-attribute-value) generic settings/fields system. Settings are a typed `jsonb` blob per template.
- A fully generic "export mapping DSL." Each tracker just implements three functions (`toCsvRows`, `toXlsxSheets`, `toPdfSections`); the *writers* (CSV/XLSX/PDF serialization) are the reusable part, not the mapping.
- A generic conflict-resolution/CRDT engine. MVP uses record-level last-write-wins plus ledger-style append-only domain tables to keep the conflict surface small; a real CRDT is only justified once concurrent shared-tracker editing is a real, shipped feature.
- A single polymorphic `records` table for all tracker domain data. Each tracker gets its own real Postgres tables with real columns — better query performance, better types, better RLS clarity, and Postgres already gives us schema flexibility where we actually need it (`settings jsonb`).

Where genuine reuse exists (persistence, sync, export writers, membership/RLS shape, UI state components), it is abstracted once, in the engine. Where it doesn't (domain math, domain schema, domain UI), each tracker owns its own code plainly.

---

## 11. PWA Architecture

- **Service worker**: generated via Serwist, integrated at the Next.js build step.
- **Caching strategy**: app shell (JS/CSS/fonts) — stale-while-revalidate keyed to build ID; static assets (icons, manifest) — cache-first; no caching of Supabase API responses in the service worker (data freshness is the sync engine's job, not the SW's).
- **Offline fallback**: a minimal offline page only for the rare route that isn't already client-rendered from local data (marketing pages loaded for the first time with no connectivity).
- **Update strategy**: new service worker installs in the background; app shows a small non-blocking "Update available — tap to refresh" banner rather than forcing a silent reload (which could interrupt data entry).
- Explicitly not claiming full offline capability for authentication-gated flows (e.g., initiating a brand-new sign-up) — those require network by nature. What's guaranteed offline is: using an already-loaded tracker, local-first read/write.

---

## 12. Mobile-First UX & Performance

- Bottom navigation (3–4 items max), sticky primary action buttons (e.g., "Record Payment") pinned above the safe-area inset.
- Bottom sheets (not modals) for entry forms on mobile; shadcn `Sheet`/`Dialog` primitives adapted responsively.
- Tables become stacked cards on mobile; a real table is a desktop progressive enhancement, not the mobile source of truth.
- Rendering strategy: marketing/discovery routes are React Server Components (fast first load, good for a public site); the tracker workspace crosses into a client boundary once (its root layout), since it fundamentally depends on IndexedDB.
- Charts (progress rings, payoff trend) are dynamically imported with `ssr: false` — they're client/canvas-heavy and not needed for first paint.
- Large trackers (long payment history): paginate/virtualize lists; export generation for large datasets should not block the main thread — candidate for a Web Worker if profiling shows it's needed, not built preemptively.

---

## 13. Security Summary

- RLS is the sole server-side authorization boundary; client-supplied `tracker_id`/`owner_id` claims are never trusted, only session identity (`auth.uid()`) is.
- Service-role key never ships to the client; privileged operations run through RPCs/Edge Functions.
- Anonymous/local data never touches the server — its only "security boundary" is the user's own device/browser profile (documented limitation, not a gap to silently accept — see Open Decisions on incognito/private browsing).
- Account deletion cascades ownership: deleting the sole owner of a tracker deletes the tracker and its records (documented, explicit, confirmed via typed confirmation) for MVP; shared-tracker ownership transfer is deferred until sharing ships.
- Exports/imports are client-side computations over already-authorized data; no new server attack surface introduced by them in MVP.

---

## 14. Project Structure (proposed)

```
app/
  (marketing)/                  # RSC: homepage, category pages, template gallery, help
  (workspace)/
    trackers/[trackerId]/...    # client boundary: dashboard, detail, settings
  account/                      # sign-in/up, profile, sync status
lib/
  supabase/                     # client.ts, server.ts, generated types
  db/                           # Dexie schema + LocalStore
  sync/                         # outbox, SyncEngine, migration RPC client
  export/                       # csv.ts, xlsx.ts, pdf.ts (generic writers)
  import/                       # csv-parser.ts, mapping.ts, validators.ts
  auth/                         # session helpers, anon→auth migration orchestration
trackers/
  _registry.ts                 # imports & registers every TrackerDefinition
  debt/
    schema.ts                  # zod schema, shared local/remote/API validation
    calculations.ts            # balance/progress/payoff derivations
    definition.ts              # TrackerDefinition export
    components/                # Dashboard, Detail, Forms
    export.ts
    import.ts
components/
  ui/                           # shadcn primitives
  platform/                     # EmptyState, ErrorState, SyncStatusChip, ConfirmDialog, BottomSheet
docs/
public/
  manifest.json, icons/
supabase/                       # (future, Phase 1+) migrations/, functions/
```

This makes the platform/tracker boundary a literal directory boundary: anything under `trackers/<name>/` is domain-specific; everything else is platform.

---

## 15. Testing Strategy (pre-implementation plan)

| Layer | Tool | Focus |
|---|---|---|
| Domain calculations | Vitest | balance/progress/payoff derivations — deterministic, exhaustive edge cases (see Debt spec §Edge Cases) |
| Local persistence | Vitest + `fake-indexeddb` | Dexie read/write, tombstones, schema migrations |
| Sync engine | Vitest, mocked Supabase client | outbox ordering, retry/backoff, idempotent upsert, conflict flagging |
| Migration (anon→account) | Integration test against local Supabase (CLI) | duplicate-retry safety, count verification, partial-failure rollback |
| RLS | SQL assertions against local Supabase instance | cross-tracker access denial, role-based write restrictions |
| Components | React Testing Library | forms, confirmation flows, empty/error states |
| End-to-end | Playwright, mobile viewport | golden path: anonymous create → enter data → refresh → export → sign up → migrate → reload as authenticated |

Debt calculations in particular must be table-tested against every edge case enumerated in the Debt Tracker spec (zero debt, overpayment, edited original amount, historical payments, etc.) before Phase 2 is considered done.
