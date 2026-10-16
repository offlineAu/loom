import { describe, expect, it } from "vitest";
import { checkPersistenceAvailability, evaluateAvailability } from "@/lib/persistence/availability";

describe("evaluateAvailability (pure decision logic)", () => {
  it("is unavailable when there is no IndexedDB API", () => {
    expect(evaluateAvailability(false, false)).toEqual({ status: "unavailable", reason: "no-api" });
  });

  it("is unavailable when the API exists but opening the database failed", () => {
    expect(evaluateAvailability(true, false)).toEqual({ status: "unavailable", reason: "open-failed" });
  });

  it("is available when the API exists and opening succeeded", () => {
    expect(evaluateAvailability(true, true)).toEqual({ status: "available" });
  });
});

describe("checkPersistenceAvailability (integration, real fake-indexeddb)", () => {
  it("reports available in this test environment", async () => {
    const result = await checkPersistenceAvailability();
    expect(result.status).toBe("available");
  });
});
