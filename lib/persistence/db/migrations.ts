import type Dexie from "dexie";
import { SCHEMA_VERSIONS } from "@/lib/persistence/db/schema";

/**
 * Applies every schema version, in order, to a Dexie instance. This is the
 * migration mechanism: Dexie requires every historical version to be
 * declared (not just the latest), replaying `.version(N).stores({...})` for
 * each one, so that a browser opening the database from an older version
 * upgrades through each intermediate step safely.
 *
 * Migration strategy for a future schema change:
 *   1. Add a new entry to `SCHEMA_VERSIONS` in schema.ts (bump `version`,
 *      give the *full* cumulative `stores` map for that version — Dexie
 *      needs the whole map, not just the diff).
 *   2. If existing rows need transforming (e.g. a new required field),
 *      attach a `.upgrade(tx => ...)` callback to that version's builder
 *      below. No upgrade callback runs today because version 1 is the
 *      first version — there is nothing to transform yet.
 *   3. Never remove or edit a shipped version's entry. A user's browser may
 *      still be on an older version and needs every intermediate step to
 *      exist to upgrade correctly. This is the same rule as SQL migrations:
 *      historical migrations are immutable, only new ones are added.
 *
 * Data-loss rule: an upgrade must never silently drop existing rows. If a
 * future version needs to reshape data, that reshaping belongs in that
 * version's `.upgrade()` callback (which runs inside the version's own
 * transaction against the *existing* data), not in application code that
 * runs after open.
 */
export function applySchema(db: Dexie): void {
  for (const { version, stores } of SCHEMA_VERSIONS) {
    db.version(version).stores(stores);
    // Future versions needing a data transform attach it like:
    //   db.version(2).stores({ ... }).upgrade(async (tx) => { ... });
  }
}
