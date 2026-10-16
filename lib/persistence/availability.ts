import { getLoomDatabase } from "@/lib/persistence/db/loom-db";

export type PersistenceAvailability = "unknown" | "available" | "unavailable";

export interface AvailabilityResult {
  status: PersistenceAvailability;
  /** Machine-readable reason, for logging/debugging — never shown verbatim to users. */
  reason?: "no-browser" | "no-api" | "open-failed";
}

/**
 * Pure decision logic, factored out of `checkPersistenceAvailability` so it
 * can be unit tested without needing to fake an actually-broken IndexedDB
 * environment (private-mode Safari, storage-disabled browsers, etc. are
 * hard to reproduce faithfully under jsdom/fake-indexeddb).
 */
export function evaluateAvailability(hasIndexedDb: boolean, openSucceeded: boolean): AvailabilityResult {
  if (!hasIndexedDb) {
    return { status: "unavailable", reason: "no-api" };
  }
  if (!openSucceeded) {
    return { status: "unavailable", reason: "open-failed" };
  }
  return { status: "available" };
}

/**
 * Follows Decision D-005: detect when persistence is unavailable (missing
 * API, or a browser that blocks it — e.g. some private-browsing modes) and
 * report it, rather than attempting a fragile workaround. Safe to call
 * repeatedly; each call re-checks rather than assuming a cached result is
 * still true (a user could change browser settings between checks).
 */
export async function checkPersistenceAvailability(): Promise<AvailabilityResult> {
  if (typeof window === "undefined") {
    return { status: "unavailable", reason: "no-browser" };
  }

  if (!("indexedDB" in window) || window.indexedDB == null) {
    return evaluateAvailability(false, false);
  }

  try {
    const db = getLoomDatabase();
    await db.open();
    return evaluateAvailability(true, true);
  } catch {
    return evaluateAvailability(true, false);
  }
}
