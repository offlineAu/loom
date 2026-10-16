import { describe, expect, it, vi } from "vitest";
import { LoomDatabase } from "@/lib/persistence/db/loom-db";
import { DexieTrackerRepository } from "@/lib/persistence/repositories/tracker-repository";
import { DexieTrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";
import { PersistenceNotFoundError } from "@/lib/persistence/errors";
import { generateId, isUlid } from "@/lib/platform/ids";
import type { TrackerRow } from "@/lib/persistence/types/rows";

function createTestDb(name = `test-tracker-repo-${crypto.randomUUID()}`) {
  return new LoomDatabase(name);
}

describe("DexieTrackerRepository.create", () => {
  it("creates a tracker with a valid ULID and an anonymous owner member", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    const tracker = await repo.create({ templateKey: "debt", name: "My Credit Card Debt" });

    expect(isUlid(tracker.id)).toBe(true);
    expect(tracker.templateKey).toBe("debt");
    expect(tracker.name).toBe("My Credit Card Debt");
    expect(tracker.archivedAt).toBeNull();
    expect(tracker.members).toEqual([{ userId: null, role: "owner" }]);

    await db.close();
  });

  it("requires no authentication (anonymous creation works with no userId anywhere)", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);
    const memberRepo = new DexieTrackerMemberRepository(db);

    const tracker = await repo.create({ templateKey: "debt", name: "Anonymous Tracker" });
    const members = await memberRepo.listByTracker(tracker.id);

    expect(members).toHaveLength(1);
    expect(members[0].userId).toBeNull();
    expect(members[0].role).toBe("owner");

    await db.close();
  });

  it("persists tracker creation and membership atomically — a failed membership write leaves no tracker behind", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    const addSpy = vi.spyOn(db.trackerMembers, "add").mockRejectedValueOnce(new Error("forced failure"));

    await expect(repo.create({ templateKey: "debt", name: "Should not persist" })).rejects.toThrow();

    const allTrackers = await db.trackers.toArray();
    expect(allTrackers).toHaveLength(0);

    addSpy.mockRestore();
    await db.close();
  });
});

describe("DexieTrackerRepository.getById / list", () => {
  it("returns null for a tracker that does not exist", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    expect(await repo.getById(generateId())).toBeNull();

    await db.close();
  });

  it("supports multiple independent local trackers", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    const a = await repo.create({ templateKey: "debt", name: "Tracker A" });
    const b = await repo.create({ templateKey: "debt", name: "Tracker B" });
    const c = await repo.create({ templateKey: "debt", name: "Tracker C" });

    expect(new Set([a.id, b.id, c.id]).size).toBe(3);

    const list = await repo.list({ templateKey: "debt" });
    expect(list.map((t) => t.id).sort()).toEqual([a.id, b.id, c.id].sort());
    for (const tracker of list) {
      expect(tracker.members).toEqual([{ userId: null, role: "owner" }]);
    }

    await db.close();
  });

  it("filters by templateKey", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    const debt = await repo.create({ templateKey: "debt", name: "Debt one" });
    await repo.create({ templateKey: "savings", name: "Savings one" });

    const debtOnly = await repo.list({ templateKey: "debt" });
    expect(debtOnly.map((t) => t.id)).toEqual([debt.id]);

    await db.close();
  });

  it("excludes archived trackers by default and includes them when asked", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    const active = await repo.create({ templateKey: "debt", name: "Active" });
    const toArchive = await repo.create({ templateKey: "debt", name: "Will archive" });
    await repo.archive(toArchive.id);

    const defaultList = await repo.list({ templateKey: "debt" });
    expect(defaultList.map((t) => t.id)).toEqual([active.id]);

    const fullList = await repo.list({ templateKey: "debt", includeArchived: true });
    expect(fullList.map((t) => t.id).sort()).toEqual([active.id, toArchive.id].sort());

    await db.close();
  });

  it("keeps membership queries isolated per tracker (no cross-tracker leakage)", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);
    const memberRepo = new DexieTrackerMemberRepository(db);

    const a = await repo.create({ templateKey: "debt", name: "A" });
    const b = await repo.create({ templateKey: "debt", name: "B" });

    const membersOfA = await memberRepo.listByTracker(a.id);
    const membersOfB = await memberRepo.listByTracker(b.id);

    expect(membersOfA.every((m) => m.trackerId === a.id)).toBe(true);
    expect(membersOfB.every((m) => m.trackerId === b.id)).toBe(true);
    expect(membersOfA.map((m) => m.id)).not.toContain(membersOfB[0].id);

    await db.close();
  });
});

describe("DexieTrackerRepository.update / archive / restore", () => {
  it("updates name and settings without touching membership", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);
    const memberRepo = new DexieTrackerMemberRepository(db);

    const tracker = await repo.create({ templateKey: "debt", name: "Original name" });
    const membersBefore = await memberRepo.listByTracker(tracker.id);

    const updated = await repo.update(tracker.id, { name: "New name", settings: { currency: "PHP" } });

    expect(updated.name).toBe("New name");
    expect(updated.settings).toEqual({ currency: "PHP" });
    expect(updated.updatedAt >= tracker.updatedAt).toBe(true);

    const membersAfter = await memberRepo.listByTracker(tracker.id);
    expect(membersAfter).toEqual(membersBefore);

    await db.close();
  });

  it("archives and restores a tracker", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    const tracker = await repo.create({ templateKey: "debt", name: "Archive me" });
    const archived = await repo.archive(tracker.id);
    expect(archived.archivedAt).not.toBeNull();

    const restored = await repo.restore(tracker.id);
    expect(restored.archivedAt).toBeNull();

    await db.close();
  });

  it("throws PersistenceNotFoundError when updating a tracker that does not exist", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    await expect(repo.update(generateId(), { name: "nope" })).rejects.toBeInstanceOf(PersistenceNotFoundError);
    await expect(repo.archive(generateId())).rejects.toBeInstanceOf(PersistenceNotFoundError);
    await expect(repo.restore(generateId())).rejects.toBeInstanceOf(PersistenceNotFoundError);

    await db.close();
  });
});

describe("DexieTrackerRepository.deletePermanently", () => {
  it("removes the tracker and its membership rows", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);
    const memberRepo = new DexieTrackerMemberRepository(db);

    const tracker = await repo.create({ templateKey: "debt", name: "Delete me" });
    await repo.deletePermanently(tracker.id);

    expect(await repo.getById(tracker.id)).toBeNull();
    expect(await memberRepo.listByTracker(tracker.id)).toHaveLength(0);

    await db.close();
  });

  it("throws PersistenceNotFoundError for a tracker that does not exist", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);

    await expect(repo.deletePermanently(generateId())).rejects.toBeInstanceOf(PersistenceNotFoundError);

    await db.close();
  });
});

describe("primary key integrity", () => {
  it("rejects a second row with a duplicate id instead of silently overwriting it", async () => {
    const db = createTestDb();
    const id = generateId();
    const now = new Date().toISOString();
    const row: TrackerRow = {
      id,
      templateKey: "debt",
      name: "First",
      settings: {},
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      syncState: "local_only",
      serverId: null,
      serverUpdatedAt: null,
    };

    // `.add()` (what create() uses) must reject a duplicate key — this is
    // exactly why update/archive/restore deliberately use `.put()` instead,
    // only for a row already known to exist.
    await db.trackers.add(row);
    await expect(db.trackers.add(row)).rejects.toThrow();

    const stored = await db.trackers.toArray();
    expect(stored).toHaveLength(1);

    await db.close();
  });
});

describe("refresh / rehydration", () => {
  it("survives closing and reopening the database (simulated browser refresh)", async () => {
    const name = `test-refresh-${crypto.randomUUID()}`;
    const dbA = new LoomDatabase(name);
    const repoA = new DexieTrackerRepository(dbA);

    const created = await repoA.create({ templateKey: "debt", name: "My Debt Tracker" });
    await repoA.archive(created.id); // exercise archive state surviving too
    const restored = await repoA.restore(created.id);
    await dbA.close();

    const dbB = new LoomDatabase(name);
    const repoB = new DexieTrackerRepository(dbB);
    const reloaded = await repoB.getById(created.id);

    expect(reloaded).not.toBeNull();
    expect(reloaded).toEqual(restored);
    expect(reloaded?.members).toEqual([{ userId: null, role: "owner" }]);

    await dbB.close();
  });
});
