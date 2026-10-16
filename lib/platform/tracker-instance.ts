import { generateId, type Ulid } from "@/lib/platform/ids";

/**
 * Access level for a member of a tracker. Modeled from day one (Phase 0
 * platform architecture, D-006/D-007) so shared trackers (e.g. Couple
 * Budget) never require redesigning ownership later.
 */
export type TrackerRole = "owner" | "editor" | "viewer";

/**
 * A person's relationship to a tracker instance. `userId` is null for a
 * local-only (anonymous, device-bound) tracker that has no cloud account
 * attached yet.
 */
export interface TrackerMember {
  userId: string | null;
  role: TrackerRole;
}

/**
 * A concrete tracker a user created (e.g. "My Credit Card Debt"). Ownership
 * is deliberately NOT a single `userId` field on the tracker itself — it is
 * always derived from `members`, so a tracker can move from anonymous/local
 * to owned, and later to shared, without a schema change.
 */
export interface TrackerInstance {
  id: Ulid;
  templateKey: string;
  name: string;
  members: TrackerMember[];
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export function createLocalTrackerInstance(
  templateKey: string,
  name: string
): TrackerInstance {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    templateKey,
    name,
    members: [{ userId: null, role: "owner" }],
    settings: {},
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}

export function getOwner(tracker: TrackerInstance): TrackerMember | undefined {
  return tracker.members.find((member) => member.role === "owner");
}

export function isLocalOnly(tracker: TrackerInstance): boolean {
  return tracker.members.every((member) => member.userId === null);
}
