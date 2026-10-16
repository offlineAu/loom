import type { TrackerRole } from "@/lib/platform/tracker-instance";

/**
 * Row-level (persisted) shapes. These are deliberately NOT the same types as
 * the domain model in `lib/platform/tracker-instance.ts` — rows carry
 * storage/future-sync metadata that the domain model must never see (see
 * `syncState`/`serverId`/`serverUpdatedAt` below). Repositories are the only
 * code allowed to convert between the two.
 *
 * Timestamp convention: every timestamp in every row is an ISO 8601 UTC
 * string (`new Date().toISOString()`), never a `Date` object and never a
 * bare epoch number. This is deterministic, lexicographically sortable
 * (so Dexie indexes on these fields sort chronologically for free), and
 * directly compatible with Postgres `timestamptz` text input for the future
 * Supabase sync phase.
 */

export type SyncState = "local_only" | "pending" | "synced" | "conflict" | "error";

export interface TrackerRow {
  /** Client-generated ULID (Decision D-002). Never a Dexie auto-increment key. */
  id: string;
  templateKey: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;

  // --- Reserved for the future sync engine (Phase 1D). Unused today. ---
  // Every row is created with syncState "local_only" and stays that way for
  // the entire life of this phase; nothing in Phase 1B ever reads these
  // fields to make a decision. They exist now so Phase 1D can add real sync
  // behavior additively, without an ALTER-shaped migration on day one of
  // that phase. See docs/LOOM-PHASE-1B-IMPLEMENTATION.md "Future Sync Seam".
  syncState: SyncState;
  serverId: string | null;
  serverUpdatedAt: string | null;
}

export interface TrackerMemberRow {
  /** Client-generated ULID. A tracker can have multiple members later (sharing). */
  id: string;
  trackerId: string;
  /** null = anonymous/local-only member (no cloud account attached yet). */
  userId: string | null;
  role: TrackerRole;
  createdAt: string;
  updatedAt: string;
}
