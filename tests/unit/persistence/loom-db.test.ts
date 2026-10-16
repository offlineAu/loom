import { describe, expect, it } from "vitest";
import { LoomDatabase, getLoomDatabase } from "@/lib/persistence/db/loom-db";
import { CURRENT_SCHEMA_VERSION } from "@/lib/persistence/db/schema";

function uniqueName(): string {
  return `test-loom-db-${crypto.randomUUID()}`;
}

describe("LoomDatabase", () => {
  it("initializes with the expected tables", async () => {
    const db = new LoomDatabase(uniqueName());
    await db.open();

    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(["trackerMembers", "trackers"]);

    await db.close();
  });

  it("opens at the current schema version", async () => {
    const db = new LoomDatabase(uniqueName());
    await db.open();
    expect(db.verno).toBe(CURRENT_SCHEMA_VERSION);
    await db.close();
  });

  it("does not create Debt-specific tables (platform persistence only)", async () => {
    const db = new LoomDatabase(uniqueName());
    await db.open();
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).not.toContain("debts");
    expect(tableNames).not.toContain("debtPayments");
    expect(tableNames).not.toContain("debtAdjustments");
    await db.close();
  });
});

describe("getLoomDatabase", () => {
  it("returns the same singleton instance on repeated calls", () => {
    const a = getLoomDatabase();
    const b = getLoomDatabase();
    expect(a).toBe(b);
  });
});
