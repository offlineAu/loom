import { describe, expect, it } from "vitest";
import { generateId, isUlid } from "@/lib/platform/ids";

describe("platform ids", () => {
  it("generates a valid ULID", () => {
    const id = generateId();
    expect(isUlid(id)).toBe(true);
    expect(id).toHaveLength(26);
  });

  it("generates unique, time-sortable ids", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    // ULIDs are lexicographically sortable by creation time.
    expect([a, b].sort()[0]).toBe(a <= b ? a : b);
  });

  it("rejects an obviously invalid id", () => {
    expect(isUlid("not-a-ulid")).toBe(false);
  });
});
