import { describe, expect, it } from "vitest";
import { isUlid } from "@/lib/platform/ids";
import {
  createLocalTrackerInstance,
  getOwner,
  isLocalOnly,
} from "@/lib/platform/tracker-instance";

describe("createLocalTrackerInstance", () => {
  it("creates a tracker owned by a null (anonymous) member, not a bare user_id", () => {
    const tracker = createLocalTrackerInstance("debt", "My Credit Card Debt");

    expect(isUlid(tracker.id)).toBe(true);
    expect(tracker.templateKey).toBe("debt");
    expect(tracker.name).toBe("My Credit Card Debt");
    expect(tracker.archivedAt).toBeNull();

    // Ownership must be derived from members[], never a single user_id field —
    // this is what allows a future shared tracker without a redesign (D-006/D-007).
    expect(tracker.members).toHaveLength(1);
    expect(tracker.members[0]).toEqual({ userId: null, role: "owner" });
  });

  it("reports a freshly created tracker as local-only", () => {
    const tracker = createLocalTrackerInstance("debt", "My Debt");
    expect(isLocalOnly(tracker)).toBe(true);
  });

  it("reports a tracker with an authenticated member as not local-only", () => {
    const tracker = createLocalTrackerInstance("debt", "My Debt");
    tracker.members.push({ userId: "user_123", role: "editor" });
    expect(isLocalOnly(tracker)).toBe(false);
  });

  it("finds the owner among members", () => {
    const tracker = createLocalTrackerInstance("debt", "My Debt");
    expect(getOwner(tracker)?.role).toBe("owner");
  });
});
