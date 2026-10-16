import Dexie, { type EntityTable } from "dexie";
import { DATABASE_NAME } from "@/lib/persistence/db/schema";
import { applySchema } from "@/lib/persistence/db/migrations";
import type { TrackerMemberRow, TrackerRow } from "@/lib/persistence/types/rows";
import { PersistenceUnavailableError } from "@/lib/persistence/errors";

/**
 * The single LOOM Dexie database class. Nothing outside `lib/persistence`
 * should import this class directly — go through the repositories
 * (`lib/persistence/repositories/*`) or the barrel (`lib/persistence`).
 */
export class LoomDatabase extends Dexie {
  trackers!: EntityTable<TrackerRow, "id">;
  trackerMembers!: EntityTable<TrackerMemberRow, "id">;

  constructor(name: string = DATABASE_NAME) {
    super(name);
    applySchema(this);
  }
}

let singleton: LoomDatabase | null = null;

/**
 * Returns the one shared LoomDatabase instance for the running app. Lazily
 * constructed on first call so merely *importing* this module (which could
 * happen transitively, e.g. through a type-only reference) never touches
 * IndexedDB — only actually calling this function does, and only in the
 * browser. Never construct `new LoomDatabase()` directly outside of tests.
 */
export function getLoomDatabase(): LoomDatabase {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new PersistenceUnavailableError(
      "IndexedDB is not available in this environment (no browser, or the API is missing)."
    );
  }

  if (!singleton) {
    singleton = new LoomDatabase();
  }

  return singleton;
}
