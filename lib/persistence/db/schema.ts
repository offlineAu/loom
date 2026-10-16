export const DATABASE_NAME = "loom";

/**
 * Dexie store (index) definitions, one entry per schema version. This is the
 * authoritative version history — `migrations.ts` replays this list against
 * a Dexie instance in order. Never edit an already-shipped version's
 * `stores` string; add a new version entry instead (see migrations.ts).
 *
 * Index string notes:
 * - The first field in each store string is the primary key. It is always
 *   our own client-generated ULID (`id`) — never `++id` (Dexie's
 *   auto-increment syntax). Auto-increment must never become the
 *   application identity (Decision D-002).
 * - `trackers` indexes `templateKey` (catalog filtering), `archivedAt`
 *   (active/archived filtering) and `createdAt` (chronological listing).
 * - `trackerMembers` indexes `trackerId` (the hot path: "get this tracker's
 *   members"), `userId` (future: "get this user's trackers", once auth
 *   exists — rows with `userId: null` are simply omitted from this index,
 *   which is standard IndexedDB behavior, not a bug) and the compound
 *   `[trackerId+userId]` (future: "is this specific user already a member
 *   of this tracker").
 */
export const SCHEMA_VERSIONS = [
  {
    version: 1,
    description: "Initial platform persistence: trackers + tracker membership.",
    stores: {
      trackers: "id, templateKey, archivedAt, createdAt",
      trackerMembers: "id, trackerId, userId, [trackerId+userId]",
    },
  },
] as const;

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;
