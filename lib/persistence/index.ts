import { getLoomDatabase } from "@/lib/persistence/db/loom-db";
import { DexieTrackerRepository, type TrackerRepository } from "@/lib/persistence/repositories/tracker-repository";
import {
  DexieTrackerMemberRepository,
  type TrackerMemberRepository,
} from "@/lib/persistence/repositories/tracker-member-repository";

export type {
  TrackerRepository,
  ListTrackersOptions,
  UpdateTrackerInput,
} from "@/lib/persistence/repositories/tracker-repository";
export type { TrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";
export type { TrackerRow, TrackerMemberRow, SyncState } from "@/lib/persistence/types/rows";
export {
  PersistenceError,
  PersistenceUnavailableError,
  PersistenceInitializationError,
  PersistenceNotFoundError,
  PersistenceConstraintError,
  PersistenceTransactionError,
} from "@/lib/persistence/errors";
export {
  checkPersistenceAvailability,
  type PersistenceAvailability,
  type AvailabilityResult,
} from "@/lib/persistence/availability";

/**
 * This is the ONLY module application code (hooks, and nothing else —
 * components should go through a hook, not this directly) should import to
 * reach persistence. It hides Dexie and the concrete repository classes
 * behind singletons so the rest of the app depends on the `TrackerRepository`
 * contract, not on IndexedDB.
 */

let trackerRepository: TrackerRepository | null = null;

export function getTrackerRepository(): TrackerRepository {
  if (!trackerRepository) {
    trackerRepository = new DexieTrackerRepository(getLoomDatabase());
  }
  return trackerRepository;
}

let trackerMemberRepository: TrackerMemberRepository | null = null;

export function getTrackerMemberRepository(): TrackerMemberRepository {
  if (!trackerMemberRepository) {
    trackerMemberRepository = new DexieTrackerMemberRepository(getLoomDatabase());
  }
  return trackerMemberRepository;
}
