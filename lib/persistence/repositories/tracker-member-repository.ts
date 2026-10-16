import type { LoomDatabase } from "@/lib/persistence/db/loom-db";
import type { TrackerMemberRow } from "@/lib/persistence/types/rows";
import type { TrackerMember } from "@/lib/platform/tracker-instance";
import { generateId, type Ulid } from "@/lib/platform/ids";
import { PersistenceConstraintError, wrapPersistenceError } from "@/lib/persistence/errors";

/**
 * Low-level, table-focused access to tracker membership. Most application
 * code should go through `TrackerRepository`, which returns a fully
 * hydrated `TrackerInstance` (tracker + members together). This repository
 * exists separately because membership has its own real query shapes
 * (list a tracker's members, and — once auth exists — list a user's
 * trackers) that don't belong on the tracker-focused API.
 */
export interface TrackerMemberRepository {
  listByTracker(trackerId: Ulid): Promise<TrackerMemberRow[]>;
  listByUser(userId: string): Promise<TrackerMemberRow[]>;
  getOwner(trackerId: Ulid): Promise<TrackerMemberRow | undefined>;
}

export class DexieTrackerMemberRepository implements TrackerMemberRepository {
  constructor(private readonly db: LoomDatabase) {}

  async listByTracker(trackerId: Ulid): Promise<TrackerMemberRow[]> {
    try {
      return await this.db.trackerMembers.where("trackerId").equals(trackerId).toArray();
    } catch (error) {
      throw wrapPersistenceError(error);
    }
  }

  async listByUser(userId: string): Promise<TrackerMemberRow[]> {
    try {
      return await this.db.trackerMembers.where("userId").equals(userId).toArray();
    } catch (error) {
      throw wrapPersistenceError(error);
    }
  }

  async getOwner(trackerId: Ulid): Promise<TrackerMemberRow | undefined> {
    const members = await this.listByTracker(trackerId);
    return members.find((member) => member.role === "owner");
  }

  /**
   * Internal write path used only by `TrackerRepository` inside an already-open
   * transaction that also touches `trackers`. Verifies the parent tracker
   * exists (within that same transaction) before inserting, so a membership
   * row can never reference a tracker that doesn't exist — this is what
   * makes an orphaned member structurally impossible rather than merely
   * discouraged by convention.
   */
  async createWithinTransaction(trackerId: Ulid, member: TrackerMember): Promise<TrackerMemberRow> {
    const trackerExists = (await this.db.trackers.get(trackerId)) !== undefined;
    if (!trackerExists) {
      throw new PersistenceConstraintError(
        `Cannot create a member for tracker "${trackerId}": that tracker does not exist.`
      );
    }

    const now = new Date().toISOString();
    const row: TrackerMemberRow = {
      id: generateId(),
      trackerId,
      userId: member.userId,
      role: member.role,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.trackerMembers.add(row);
    } catch (error) {
      throw wrapPersistenceError(error);
    }

    return row;
  }
}
