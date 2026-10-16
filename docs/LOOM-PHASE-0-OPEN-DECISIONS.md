# LOOM — Open Decisions (Phase 0)

Decisions below are recommendations, not defaults silently assumed. Items marked **Must decide before Phase 1** block starting implementation cleanly; others can be decided as they come up in Phase 1/2.

---

## Must decide before Phase 1

### 1. Package manager
Only npm is currently installed (no pnpm/yarn). **Recommendation: npm** — avoids adding a tool-install step, and none of the stack choices require pnpm's specific workspace features for a single-app repo. Revisit if the project later splits into a monorepo (e.g. sharing a package between web and a future mobile shell).

### 2. Primary ID type: ULID vs UUIDv7
Both are client-generatable and time-sortable, which is what the local-first ID strategy needs. **Recommendation: ULID** (26-char, Crockford base32, slightly more ergonomic in URLs/logs than UUIDv7's hex-with-dashes) — but this is a close call and either works; pick one and standardize before any table is created, since changing it later touches every table's primary key type.

### 3. Currency/locale defaults
Spec assumes PHP as the default currency (based on the user's context) with one currency per tracker. Confirm: is PHP the actual intended default, or should currency be chosen at tracker-creation time with no app-wide default? Also confirms number formatting locale (₱1,000.00 vs 1.000,00 ₱ etc.).

### 4. Supabase project provisioning
No Supabase project exists yet. Needs an actual account/project created (org, region — recommend closest to primary user base) before any RLS/table work in Phase 1 can be tested against a real instance, even the local CLI stack needs a linked project eventually for staging/prod parity.

### 5. Private/incognito browsing limitation
IndexedDB in private browsing windows is either unavailable or cleared on close (browser-dependent). Anonymous local-first usage silently loses data in that mode. Decide: is this an accepted, documented limitation (recommended — detect and show a warning banner: "Private browsing detected — your data won't be saved after this session, sign up to keep it") or does it need a fallback (e.g. warn-and-encourage-signup only, no technical workaround exists that isn't itself fragile)?

---

## Should decide during Phase 1

### 6. Deletion permission granularity
Platform doc (§8) leaves open whether `editor` role can hard-delete domain records or only `owner`. Debt spec's archive/permanent-delete split (§6.4) needs a final role mapping before RLS policies are written. **Recommendation**: `editor` can archive/soft-delete; only `owner` can permanently delete. Confirm before writing the DELETE RLS policies.

### 7. Conflict resolution robustness for shared trackers
MVP's last-write-wins is explicitly scoped to single-owner usage (Debt Tracker). Couple Budget Tracker (Phase 5+) will have two people editing concurrently for real. Decide, before that tracker starts: is record-level LWW still acceptable (e.g. because budget edits are naturally low-frequency/low-conflict), or does it need field-level merge or a real CRDT? Flagged here so it isn't silently inherited from Debt Tracker's simpler assumptions without a fresh look.

### 8. `next_due_date` vs `due_day`
Debt spec (§1.1) uses a simple `due_day` (1–31) for MVP simplicity. A full `next_due_date` (actual date, auto-advancing) is more useful for a real "upcoming payments" dashboard widget but adds recurrence-calculation complexity. Confirm `due_day` is sufficient for MVP or if the dashboard's "upcoming payments" feature (§8 of platform doc / §8 of Debt spec) actually needs the richer field from day one.

### 9. Interest accrual
`interest_rate` is currently informational-only (no auto-accrual of interest into the balance over time). Confirm this is intentional for MVP — auto-accruing interest correctly (compounding, day-count conventions) is a meaningfully bigger feature than the rest of Debt Tracker MVP combined, and the spec deliberately excludes it. Flag if stakeholders expect it sooner.

### 10. Activity/history log: generic platform primitive vs. per-tracker
Platform doc (§9.1) proposes a generic append-only "activity log" primitive that any tracker can write to. Confirm this is worth building generically in Phase 1, or if Debt Tracker's activity log (§6.2 of Debt spec) should just be a Debt-specific table in Phase 2, with genericization deferred to Phase 4's expansion test (per the "don't abstract until a second consumer exists" principle applied elsewhere in this spec). **Recommendation: build it Debt-specific in Phase 2**, genericize in Phase 4 if Tasks also needs one — consistent with how Export/Import were deliberately deferred to Phase 2 rather than built speculatively in Phase 1.

---

## Risks (not blocking, but tracked)

- **RLS correctness is entirely untested until Phase 1/3.** This is the single highest-severity risk in the whole architecture — a missing or malformed policy is a real data leak, not a cosmetic bug. Must have real adversarial tests (Phase 3), not just "it worked when I tried it as myself."
- **Offline/PWA guarantees are aspirational until implemented and profiled.** This document intentionally avoids promising "full offline support" — Phase 1/3 must validate actual behavior on real devices, especially around service worker update races and IndexedDB private-browsing limitations (see #5).
- **Export/PDF generation performance on very large trackers** is unverified — client-side generation of a multi-hundred-payment PDF/XLSX could be slow on low-end mobile devices. Flagged for a profiling pass in Phase 3, with a Web Worker as the fallback mitigation if needed.
- **Migration RPC is the single most safety-critical piece of code in the app** (§5.5 of platform doc) — any bug there risks duplicate or lost financial records during account creation, which is the worst possible first impression. Recommend it gets disproportionate test coverage relative to its code size.

---

## Assumptions made in this Phase 0 spec

- Assumed a single-currency-per-tracker model is acceptable (no multi-currency support requested).
- Assumed "optional authentication" means fully-optional-forever for anonymous single-device use, not a time-limited trial — confirm this matches the intended business model (e.g., no future paywall gating sync itself).
- Assumed Debt Tracker is genuinely the first tracker to ship (not Monthly Budget Tracker or another Money-category tracker) based on the prompt's explicit framing — confirm this is still current before Phase 2 kicks off.
- Assumed shadcn/ui + Radix's accessibility defaults are sufficient as a baseline and don't need a from-scratch a11y component layer.

---

## Recommended decision-making order

1. Confirm #1–#5 (blocking) before writing any Phase 1 code.
2. Confirm #6 before RLS policies are written (early Phase 1).
3. Confirm #8–#9 before the Debt onboarding/detail UI is finalized (Phase 2).
4. Confirm #7 well before Phase 5's Couple Budget Tracker starts, not at the start of Phase 5 itself — it affects how "generic" the sync engine's conflict handling needs to be, which is core platform code.
5. #10 can be decided lightly now or explicitly deferred to Phase 4 as recommended.
