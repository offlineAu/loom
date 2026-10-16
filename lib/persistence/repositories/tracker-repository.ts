import type { LoomDatabase } from "@/lib/persistence/db/loom-db";
import type { TrackerMemberRow, TrackerRow } from "@/lib/persistence/types/rows";
import {
  createLocalTrackerInstance,
  type TrackerInstance,
  type TrackerMember,
} from "@/lib/platform/tracker-instance";
import type { Ulid } from "@/lib/platform/ids";
import {
  PersistenceNotFoundError,
  wrapPersistenceError,
} from "@/lib/persistence/errors";
import { DexieTrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";

export interface ListTrackersOptions {
  templateKey?: string;
  includeArchived?: boolean;
}

export interface UpdateTrackerInput {
  name?: string;
  settings?: Record<string, unknown>;
}

/**
 * The primary, application-facing persistence contract for tracker
 * instances. Returns/accepts the platform domain model
 * (`TrackerInstance`/`TrackerMember` from `lib/platform/tracker-instance`)
 * — never a raw Dexie row — so UI code never needs to know IndexedDB exists.
 */
export interface TrackerRepository {
  create(input: { templateKey: string; name: string }): Promise<TrackerInstance>;
  getById(id: Ulid): Promise<TrackerInstance | null>;
  list(options?: ListTrackersOptions): Promise<TrackerInstance[]>;
  update(id: Ulid, patch: UpdateTrackerInput): Promise<TrackerInstance>;
  archive(id: Ulid): Promise<TrackerInstance>;
  restore(id: Ulid): Promise<TrackerInstance>;
  deletePermanently(id: Ulid): Promise<void>;
}

function rowToInstance(row: TrackerRow, memberRows: TrackerMemberRow[]): TrackerInstance {
  const members: TrackerMember[] = memberRows.map((m) => ({ userId: m.userId, role: m.role }));
  return {
    id: row.id as Ulid,
    templateKey: row.templateKey,
    name: row.name,
    members,
    settings: row.settings,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function instanceToRow(instance: TrackerInstance): TrackerRow {
  return {
    id: instance.id,
    templateKey: instance.templateKey,
    name: instance.name,
    settings: instance.settings,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
    archivedAt: instance.archivedAt,
    // Every locally created tracker starts (and, in this phase, stays)
    // local_only — Phase 1D owns ever changing this.
    syncState: "local_only",
    serverId: null,
    serverUpdatedAt: null,
  };
}

export class DexieTrackerRepository implements TrackerRepository {
  private readonly members: DexieTrackerMemberRepository;

  constructor(private readonly db: LoomDatabase) {
    this.members = new DexieTrackerMemberRepository(db);
  }

  async create(input: { templateKey: string; name: string }): Promise<TrackerInstance> {
    const instance = createLocalTrackerInstance(input.templateKey, input.name);
    const trackerRow = instanceToRow(instance);
    const [owner] = instance.members;

    try {
      await this.db.transaction("rw", this.db.trackers, this.db.trackerMembers, async () => {
        await this.db.trackers.add(trackerRow);
        await this.members.createWithinTransaction(instance.id, owner);
      });
    } catch (error) {
      throw wrapPersistenceError(error);
    }

    return instance;
  }

  async getById(id: Ulid): Promise<TrackerInstance | null> {
    let row: TrackerRow | undefined;
    try {
      row = await this.db.trackers.get(id);
    } catch (error) {
      throw wrapPersistenceError(error);
    }

    if (!row) {
      return null;
    }

    const memberRows = await this.members.listByTracker(id);
    return rowToInstance(row, memberRows);
  }

  async list(options: ListTrackersOptions = {}): Promise<TrackerInstance[]> {
    let rows: TrackerRow[];
    try {
      rows = await this.db.trackers.toArray();
    } catch (error) {
      throw wrapPersistenceError(error);
    }

    const filtered = rows.filter((row) => {
      if (options.templateKey && row.templateKey !== options.templateKey) return false;
      if (!options.includeArchived && row.archivedAt !== null) return false;
      return true;
    });

    if (filtered.length === 0) {
      return [];
    }

    // Batch-load every matching tracker's members in one query instead of
    // one query per tracker (avoids an N+1 access pattern as the gallery/list
    // grows).
    const ids = filtered.map((row) => row.id);
    let allMembers: TrackerMemberRow[];
    try {
      allMembers = await this.db.trackerMembers.where("trackerId").anyOf(ids).toArray();
    } catch (error) {
      throw wrapPersistenceError(error);
    }

    const membersByTracker = new Map<string, TrackerMemberRow[]>();
    for (const member of allMembers) {
      const bucket = membersByTracker.get(member.trackerId);
      if (bucket) {
        bucket.push(member);
      } else {
        membersByTracker.set(member.trackerId, [member]);
      }
    }

    return filtered
      .map((row) => rowToInstance(row, membersByTracker.get(row.id) ?? []))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async update(id: Ulid, patch: UpdateTrackerInput): Promise<TrackerInstance> {
    return this.applyPatch(id, () => ({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
    }));
  }

  async archive(id: Ulid): Promise<TrackerInstance> {
    return this.applyPatch(id, () => ({ archivedAt: new Date().toISOString() }));
  }

  async restore(id: Ulid): Promise<TrackerInstance> {
    return this.applyPatch(id, () => ({ archivedAt: null }));
  }

  async deletePermanently(id: Ulid): Promise<void> {
    try {
      await this.db.transaction("rw", this.db.trackers, this.db.trackerMembers, async () => {
        const existing = await this.db.trackers.get(id);
        if (!existing) {
          throw new PersistenceNotFoundError(`No tracker found with id "${id}".`);
        }
        await this.db.trackerMembers.where("trackerId").equals(id).delete();
        await this.db.trackers.delete(id);
      });
    } catch (error) {
      throw wrapPersistenceError(error);
    }
  }

  private async applyPatch(
    id: Ulid,
    buildPatch: () => Partial<Pick<TrackerRow, "name" | "settings" | "archivedAt">>
  ): Promise<TrackerInstance> {
    try {
      await this.db.transaction("rw", this.db.trackers, async () => {
        const existing = await this.db.trackers.get(id);
        if (!existing) {
          throw new PersistenceNotFoundError(`No tracker found with id "${id}".`);
        }
        const updated: TrackerRow = {
          ...existing,
          ...buildPatch(),
          updatedAt: new Date().toISOString(),
        };
        await this.db.trackers.put(updated);
      });
    } catch (error) {
      throw wrapPersistenceError(error);
    }

    const result = await this.getById(id);
    if (!result) {
      // Cannot happen in practice (we just wrote the row inside the
      // transaction above) — guarded to keep getById's null return honest.
      throw new PersistenceNotFoundError(`No tracker found with id "${id}".`);
    }
    return result;
  }
}
