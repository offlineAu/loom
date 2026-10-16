# LOOM — Implementation Roadmap (Phase 0 Output)

This sequence follows from the architecture in `LOOM-PHASE-0-PLATFORM-ARCHITECTURE.md` and `LOOM-PHASE-0-DEBT-TRACKER-SPEC.md`. It was written before any implementation started, as one monolithic "Phase 1."

> **Addendum (post Phase 1B): how "Phase 1" actually split up.** In execution, Phase 1 below was broken into sequential sub-phases rather than built as a single pass, specifically so the local-first seam could be built and validated *before* introducing Supabase/auth/sync — each sub-phase has its own report under `docs/`:
> - **Phase 1A** (`LOOM-PHASE-1A-IMPLEMENTATION.md`): repo scaffold, LOOM design tokens, platform UI primitives, gallery/category pages, PWA manifest, testing scaffolding — everything in this plan's list *except* Supabase, Dexie, auth, and migration.
> - **Phase 1B** (`LOOM-PHASE-1B-IMPLEMENTATION.md`): the Dexie local database, repository layer, and the generic tracker CRUD/archive/restore flow — i.e. this plan's "Dexie local database setup" and "`TrackerRepository`/`LocalStore` skeleton" bullets, deliberately built and proven *without* the `sync_outbox` table, `SyncEngine`, or `SyncStatusChip` — those remain future work (see that report's "Future Sync Seam" section for how the schema stays additive-ready for them).
> - **Not yet started**: Supabase provisioning/RLS, auth, the migration RPC, and the PWA service worker — still exactly as scoped below, just not yet built.
>
> No other content in this file has been changed; read the bullets below as the original, not-yet-fully-executed plan, and the two implementation reports as the record of what actually happened.

---

## Phase 1 — Platform Foundation

Goal: a running Next.js app with the platform seams in place, but no tracker domain logic yet.

- Repo scaffold: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, npm as package manager (see Open Decisions).
- LOOM design tokens layer (colors, radius, spacing, glass/gradient utilities, dark mode variables).
- Supabase project provisioning; `profiles`, `trackers`, `tracker_members` tables + RLS policies; `is_tracker_member()` helper function.
- Dexie local database setup: `trackers` table + `sync_outbox` table.
- `TrackerRepository` / `LocalStore` / `SyncEngine` skeleton (create/read/update/delete + outbox, no tracker-specific domain tables yet).
- Auth flow (sign-up/sign-in via Supabase Auth), session handling.
- Anonymous → account migration RPC (`migrate_tracker`) and client-side orchestration — built and tested generically even before a domain tracker exists (it only needs a tracker's own record + a placeholder child table to prove correctness), OR deferred to land alongside Phase 2's first real tracker if that proves cleaner in practice.
- Platform UI primitives: EmptyState, ErrorState, ConfirmDialog, SyncStatusChip, BottomSheet wrapper, bottom navigation shell.
- Category/home/tracker-gallery pages (RSC), tracker creation flow (generic, template-agnostic).
- PWA shell via Serwist: manifest, service worker, install prompt, update banner.
- Testing scaffolding: Vitest + fake-indexeddb, Playwright, local Supabase CLI stack for RLS tests.

Exit criteria: a user can create a (template-less or minimally-templated) tracker anonymously, have it persist across refresh, sign up, and see it migrate to Supabase — proving the platform seam end-to-end before any domain complexity is added.

---

## Phase 2 — Debt Tracker MVP

Goal: the first real tracker, built entirely as a module against the Phase 1 platform.

- `debts`, `debt_payments`, `debt_adjustments` Supabase tables + RLS (deriving from `tracker_members` per the platform pattern).
- Corresponding Dexie tables.
- Domain schema (zod) shared across local validation, sync payloads, and any server-side checks.
- Calculation module (`calculations.ts`) implementing §5 of the Debt spec, with the full edge-case test suite (§14 of the Debt spec) written *before* or alongside the UI.
- Onboarding form supporting both `starting_balance` and `full_ledger` modes.
- Record Payment flow (unallocated by default, optional allocation).
- Adjustment flow.
- Debt Dashboard + Debt Detail pages.
- Edit flows with before/after preview for impactful edits (§6.1 of Debt spec).
- Archive/restore/permanent-delete flows.
- Export Engine generic writers (CSV/XLSX/PDF) built here (first real consumer), plus Debt's export config.
- CSV Import pipeline (parse/map/validate/preview/commit) built here (first real consumer), plus Debt's field mapping/validators.
- Full offline test pass: create/edit/delete while offline, verify sync on reconnect, verify idempotency under simulated retry.
- Full migration test pass: anonymous debt data with payments/adjustments migrating to a new account, including a simulated interrupted-then-retried migration.

Exit criteria: Debt Tracker is usable end-to-end, anonymously and authenticated, online and offline, with export/import working and all edge cases covered by tests.

---

## Phase 3 — Debt Reliability / Sync Audit

Goal: harden what Phase 2 built under real-world conditions before calling it production-ready.

- Adversarial testing: flaky network simulation, concurrent edits from two tabs/devices of the same account, killing the app mid-sync.
- RLS penetration pass: attempt cross-tracker access as a non-member, attempt role escalation via `tracker_members` writes.
- Performance pass on a large synthetic tracker (hundreds of payments): list virtualization, export generation time, IndexedDB read/write latency.
- Accessibility audit (keyboard-only pass, screen reader pass, contrast check, reduced-motion check) against the actual built UI, not just the design spec.
- Real device testing (not just responsive-resize desktop testing) for the mobile-first claims.
- Fix whatever the audit finds before treating Debt Tracker as the reference implementation for future trackers.

Exit criteria: confidence that the platform's local-first/sync/migration machinery is solid enough to be reused as-is by the next tracker, without another reliability pass per tracker.

---

## Phase 4 — Expansion Architecture Test

Goal: prove the platform boundary actually holds, using a second tracker as the test — not a redesign exercise.

- Build one additional tracker end-to-end (recommend **Tasks** first — simplest domain, no ledger/derived-balance pattern, good test of whether the platform is truly generic and not secretly Debt-shaped).
- Explicitly verify: no changes were needed to `TrackerRepository`, `SyncEngine`, Export/Import writers, RLS helper function, or navigation shell — only additive changes (new tables, new RLS policies following the existing pattern, new `TrackerDefinition`).
- If changes to shared platform code *were* needed, document exactly what and why — this is a valuable signal, not a failure.
- Optionally follow with **Inventory** (tests the ledger/derived-balance pattern reused in a second domain) as a second data point before broader rollout.

Exit criteria: a documented, evidence-based answer to "does the Tracker Engine actually generalize," with any necessary platform adjustments made explicitly and deliberately (not silently absorbed into the Tasks module as a workaround).

---

## Phase 5+ — Additional Trackers

Once Phase 4 confirms the boundary holds, remaining trackers (Monthly/Weekly/Couple Budget, Savings, Wedding Budget, Sales, Business Expenses, Inventory, Product Costing, Task Tracker refinements, Weekly To-Do Planner, Monthly Calendar, Calendar Planner) are added as independent modules, roughly in order of user demand. Couple Budget specifically is the first real exercise of the `tracker_members` multi-owner model beyond a single `owner` row — treat it as its own mini reliability pass (invite flow, second member's write conflicts, role permission edge cases) rather than assuming Phase 3's single-owner conflict handling automatically covers it.

---

## Sequencing Notes

- This order is deliberately "prove the platform with one hard tracker, stress-test it, then prove genericity with an easy one" rather than "build every tracker back to back." Reordering Phase 4 before Phase 3 was considered and rejected — expanding to a second tracker before the first one's sync/reliability story is solid would just mean debugging two trackers' worth of the same underlying bugs at once.
- Export/Import Engines are deliberately built *inside* Phase 2 (against a real tracker) rather than speculatively in Phase 1 — building a generic writer against zero real consumers risks guessing wrong about the actual seam.
