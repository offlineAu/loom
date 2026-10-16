import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SupabaseTrackerRepository } from "@/lib/persistence/cloud/tracker-repository";
import { SupabaseTrackerMemberRepository } from "@/lib/persistence/cloud/tracker-member-repository";
import { PersistenceUnavailableError } from "@/lib/persistence/errors";
import type { TrackerRepository } from "@/lib/persistence/repositories/tracker-repository";
import type { TrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";

export type { TrackerRepository, ListTrackersOptions, UpdateTrackerInput } from "@/lib/persistence/repositories/tracker-repository";
export type { TrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";
export { PersistenceError } from "@/lib/persistence/errors";

/**
 * The ONLY module application code should import to reach cloud
 * persistence — mirrors `lib/persistence/index.ts` for the local (Dexie)
 * side. Hides the Supabase client and the concrete repository classes
 * behind the same `TrackerRepository`/`TrackerMemberRepository` contracts,
 * so a hook (or, in tests, a caller) depends on the interface, not on
 * Supabase existing.
 *
 * Throws `PersistenceUnavailableError` when no Supabase project is
 * configured in this environment — the same shape of failure Phase 1B uses
 * for IndexedDB being unavailable, so callers already know how to handle it.
 */
let trackerRepository: TrackerRepository | null = null;

export function getCloudTrackerRepository(): TrackerRepository {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new PersistenceUnavailableError("Cloud accounts aren't configured in this environment.");
  }
  if (!trackerRepository) {
    trackerRepository = new SupabaseTrackerRepository(client);
  }
  return trackerRepository;
}

let trackerMemberRepository: TrackerMemberRepository | null = null;

export function getCloudTrackerMemberRepository(): TrackerMemberRepository {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new PersistenceUnavailableError("Cloud accounts aren't configured in this environment.");
  }
  if (!trackerMemberRepository) {
    trackerMemberRepository = new SupabaseTrackerMemberRepository(client);
  }
  return trackerMemberRepository;
}
