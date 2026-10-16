# LOOM — Phase 0 Decision Register

Status: **Authoritative and closed.** This document supersedes the "Open Decisions" candidates in `LOOM-PHASE-0-OPEN-DECISIONS.md` for every item listed below. Where this register and that earlier document disagree, this register wins.

---

## Decision Table

| ID | Decision | Final Choice | Rationale | Affected Phase | Status |
|---|---|---|---|---|---|
| D-001 | Package manager | **npm** | Only npm is installed in the current environment; no monorepo/workspace need exists yet that would justify pnpm/yarn/Bun | Phase 1A+ | Closed |
| D-002 | Primary application/domain ID strategy | **ULID** | Client-generatable, sortable by creation time, safe for offline creation, stable across local↔cloud sync without ID remapping | Phase 1A (types/utilities only) → Phase 1B/2 (persistence) | Closed |
| D-003 | Currency | **Per-tracker selectable, default PHP** | Avoids hard-coding one currency platform-wide while matching the primary audience's default expectation | Deferred functionality; not implemented in Phase 1A | Closed |
| D-004 | Supabase provisioning | **Must be provisioned before any DB/RLS work** | No fake/invented schema should exist; cloud persistence is a later, dedicated phase | Not Phase 1A | Closed |
| D-005 | Private/incognito browser behavior | **Detect + warn, no fragile workaround** | Attempting to defeat browser storage restrictions is brittle; honest communication preserves trust | Persistence phase (detection); Phase 1A only documents the requirement | Closed |
| D-006 | Deletion permissions | **Editors archive/soft-delete; only owners permanently delete** | Preserves financial history by default while giving owners final destructive authority | Authorization/RLS phase | Closed |
| D-007 | Shared-tracker conflict resolution | **Last-write-wins acceptable for single-owner MVP; must be revisited before any real shared tracker (e.g., Couple Budget) ships** | Debt Tracker MVP has no real concurrent multi-user editing; premature CRDT/merge engineering is over-abstraction | Sync engine phase now; revisit before Phase 5 shared trackers | Closed, with a mandatory revisit gate |
| D-008 | Debt due-date model | **`due_day` (1–31)** | Sufficient for MVP "upcoming payment" awareness without recurrence-calculation complexity | Debt domain phase (Phase 2) | Closed |
| D-009 | Interest accrual | **Informational only — no automatic accrual** | Auto-accrual (compounding, day-count conventions) is materially larger than the rest of Debt Tracker MVP; balances must only change via explicit, visible records | Debt domain phase (Phase 2) | Closed |
| D-010 | Activity/history primitive | **Small generic platform-level event primitive (not event sourcing)** — conceptual shape: `id`, `tracker_id`, `actor_user_id?`, `event_type`, `entity_type`, `entity_id`, `metadata`, `created_at` | Reusable audit trail across future trackers without building a full event-sourced architecture | Documented now; no database implementation until the persistence phase | Closed (design only) |

---

## Migration Security Invariants (documented now, implemented later)

These invariants govern the future anonymous → authenticated migration RPC (`migrate_tracker`, per `LOOM-PHASE-0-PLATFORM-ARCHITECTURE.md` §5.5). **Not implemented in Phase 1A.** Recorded here so no later phase drifts from them.

1. **Ownership derivation**: the server MUST derive the owning user from `auth.uid()` (the authenticated session) — never from a client-supplied user/owner ID in the migration payload.
2. **Parent-child integrity**: every child record (payment → debt, debt → tracker) must be verified server-side as actually belonging to the tracker being migrated. Client-declared relationships are never trusted to construct cross-tracker links.
3. **Transactionality**: migration is atomic from the user's perspective — one transaction, all rows or none. No partial state (tracker without children, some debts migrated and others dropped, membership row missing).
4. **Idempotency**: every record carries its own pre-existing client-generated ULID (D-002); the migration write is an upsert keyed on that ID, so repeating the operation never duplicates rows.
5. **Replay safety**: resubmitting the same migration payload/request must be recognized as already-applied (or safely converge to the same end state), not create a second migration.
6. **Deterministic partial-failure recovery**: if migration fails, the system must leave the user in an unambiguous state — either fully rolled back (still anonymous/local) or fully committed, never a state where local and cloud ownership both look authoritative or both look empty.
7. **Post-migration verification**: after migration, the client (or a verification step) must confirm: the tracker exists, the authenticated user has the expected membership, the expected count of child records exists, relationships are valid, local↔cloud ID mappings are complete, and no duplicates were created.

---

## Effect on Phase 1A

Phase 1A implements **only** the frontend/platform-shell foundation. It must:
- Use ULID-shaped identifiers wherever a domain/tracker ID appears in UI-level types or mock data (D-002), even though no persistence exists yet.
- Model tracker ownership in UI-level types as tracker + members (never a bare `tracker.user_id`), per D-006/D-007 and the platform architecture's membership model.
- Avoid implementing D-004 (Supabase), D-005 (real persistence-unavailability detection), D-007 (real sync), D-010 (real event table) — these are documented, not built.
- Treat this register, not ad hoc judgment calls, as the closure for every ID above; any new ambiguity discovered during Phase 1A must be added to `LOOM-PHASE-0-OPEN-DECISIONS.md` rather than resolved silently.

---

## Remaining Unresolved Items

None of D-001 through D-010 are open. Items in `LOOM-PHASE-0-OPEN-DECISIONS.md` not listed above (none remain outstanding at time of writing — all originally "must decide before Phase 1" items are closed here) are considered resolved. Phase 0 is **fully closed** as of this document.
