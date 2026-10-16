import { describe, expect, it } from "vitest";
import { LoomDatabase } from "@/lib/persistence/db/loom-db";
import { DexieTrackerRepository } from "@/lib/persistence/repositories/tracker-repository";
import { DexieTrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";
import { PersistenceConstraintError } from "@/lib/persistence/errors";
import { generateId } from "@/lib/platform/ids";

function createTestDb() {
  return new LoomDatabase(`test-member-repo-${crypto.randomUUID()}`);
}

describe("DexieTrackerMemberRepository", () => {
  it("refuses to create a membership row for a tracker that does not exist (no orphaned members)", async () => {
    const db = createTestDb();
    const memberRepo = new DexieTrackerMemberRepository(db);

    await expect(
      memberRepo.createWithinTransaction(generateId(), { userId: null, role: "owner" })
    ).rejects.toBeInstanceOf(PersistenceConstraintError);

    expect(await db.trackerMembers.toArray()).toHaveLength(0);

    await db.close();
  });

  it("getOwner finds the owner among a tracker's members", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);
    const memberRepo = new DexieTrackerMemberRepository(db);

    const tracker = await repo.create({ templateKey: "debt", name: "Owned tracker" });
    const owner = await memberRepo.getOwner(tracker.id);

    expect(owner?.role).toBe("owner");
    expect(owner?.userId).toBeNull();

    await db.close();
  });

  it("listByUser finds nothing for an anonymous (null-owned) tracker", async () => {
    const db = createTestDb();
    const repo = new DexieTrackerRepository(db);
    const memberRepo = new DexieTrackerMemberRepository(db);

    await repo.create({ templateKey: "debt", name: "Anonymous tracker" });

    expect(await memberRepo.listByUser("some-future-user-id")).toHaveLength(0);

    await db.close();
  });
});
