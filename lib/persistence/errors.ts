/**
 * Controlled persistence error vocabulary. Repositories must never let a raw
 * DexieError/DOMException reach application code — every failure is wrapped
 * into one of these so callers (hooks, UI) have a stable, small set of cases
 * to handle instead of guessing at IndexedDB internals.
 */
export abstract class PersistenceError extends Error {
  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

/** IndexedDB is not available at all (no API, or blocked by the browser). */
export class PersistenceUnavailableError extends PersistenceError {
  constructor(message = "Local storage is unavailable in this browser session.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** The database failed to open/initialize (e.g. schema/version problem). */
export class PersistenceInitializationError extends PersistenceError {
  constructor(message = "Local storage could not be initialized.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** A lookup for a specific record found nothing where a command required it to exist. */
export class PersistenceNotFoundError extends PersistenceError {
  constructor(message = "The requested record was not found.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** A uniqueness/relationship rule was violated (e.g. duplicate id, orphaned reference). */
export class PersistenceConstraintError extends PersistenceError {
  constructor(message = "The operation violates a data integrity rule.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** A multi-step operation failed and was rolled back. */
export class PersistenceTransactionError extends PersistenceError {
  constructor(message = "The operation could not be completed and was rolled back.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/**
 * The three below extend the vocabulary for the cloud (Supabase) repository
 * added in Phase 1C — Dexie has no equivalent of "not signed in" or "denied
 * by a security policy", but every repository (local or cloud) still funnels
 * every failure through this same small, controlled error set.
 */

/** A cloud operation required a signed-in user and none was present. */
export class PersistenceUnauthenticatedError extends PersistenceError {
  constructor(message = "You need to be signed in to do that.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** RLS (or an equivalent authorization rule) denied the operation. Never distinguished from "not found" in its wording — see the Phase 1C report's note on why that's deliberate. */
export class PersistenceAuthorizationError extends PersistenceError {
  constructor(message = "You don't have permission to do that.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** The request to the cloud backend never completed (offline, DNS failure, timeout). */
export class PersistenceNetworkError extends PersistenceError {
  constructor(message = "Couldn't reach the cloud — check your connection and try again.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Input failed validation before it ever reached storage. */
export class PersistenceValidationError extends PersistenceError {
  constructor(message = "That input isn't valid.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/**
 * Converts an unknown thrown value (typically a DexieError/DOMException)
 * into a controlled PersistenceError. This is the single seam every
 * repository method funnels its catch blocks through.
 */
export function wrapPersistenceError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) {
    return error;
  }

  const name = error instanceof Error ? error.name : undefined;

  if (name === "ConstraintError") {
    return new PersistenceConstraintError(
      "A record with this identity already exists or violates a data rule.",
      { cause: error }
    );
  }

  if (name === "NotFoundError") {
    return new PersistenceNotFoundError(undefined, { cause: error });
  }

  if (name === "AbortError" || name === "TransactionInactiveError") {
    return new PersistenceTransactionError(undefined, { cause: error });
  }

  if (name === "InvalidStateError" || name === "VersionError" || name === "UpgradeError") {
    return new PersistenceInitializationError(undefined, { cause: error });
  }

  return new PersistenceTransactionError(
    error instanceof Error ? error.message : "An unexpected local storage error occurred.",
    { cause: error }
  );
}
