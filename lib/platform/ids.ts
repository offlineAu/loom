import { ulid, isValid } from "ulid";

/**
 * Branded ULID type. Every tracker/domain record in LOOM is identified by a
 * client-generatable ULID (Decision D-002) so records can be created offline
 * and synced later without ever needing server-assigned IDs reconciled.
 */
export type Ulid = string & { readonly __brand: "Ulid" };

export function generateId(): Ulid {
  return ulid() as Ulid;
}

export function isUlid(value: string): value is Ulid {
  return isValid(value);
}
