import {
  PersistenceAuthorizationError,
  PersistenceConstraintError,
  PersistenceError,
  PersistenceNetworkError,
  PersistenceNotFoundError,
  PersistenceTransactionError,
  PersistenceUnauthenticatedError,
  PersistenceValidationError,
} from "@/lib/persistence/errors";

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * Converts a Supabase/PostgREST/Postgres failure into the same controlled
 * `PersistenceError` vocabulary the local (Dexie) repository uses — a UI
 * component handling a cloud-repository error never needs to know it's
 * talking to Postgres, exactly as it never needs to know about IndexedDB.
 *
 * A row an authenticated caller isn't authorized to see is, by RLS design,
 * indistinguishable from a row that doesn't exist (see
 * docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md, "Why denial looks like
 * not-found") — both surface as `PersistenceNotFoundError` here, since that
 * ambiguity is the security property, not a bug to work around.
 */
export function wrapSupabaseError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) {
    return error;
  }

  if (error instanceof TypeError) {
    // fetch() throws a bare TypeError ("Failed to fetch" / "NetworkError")
    // for DNS/offline/CORS failures — there is no PostgREST response at all.
    return new PersistenceNetworkError(undefined, { cause: error });
  }

  const pgError = error as PostgrestLikeError;
  const code = pgError?.code;

  switch (code) {
    case "PGRST116": // `.single()`/`.maybeSingle()` found zero (or >1) rows — including rows RLS filtered out
      return new PersistenceNotFoundError(undefined, { cause: error });
    case "42501": // insufficient_privilege
      return new PersistenceAuthorizationError(undefined, { cause: error });
    case "28000": // invalid_authorization_specification — raised by create_tracker() when auth.uid() is null
      return new PersistenceUnauthenticatedError(undefined, { cause: error });
    case "23505": // unique_violation
    case "23503": // foreign_key_violation
      return new PersistenceConstraintError(undefined, { cause: error });
    case "23514": // check_violation
    case "22023": // invalid_parameter_value — raised by create_tracker()'s own input validation
      return new PersistenceValidationError(pgError.message, { cause: error });
    default:
      return new PersistenceTransactionError(
        pgError?.message ?? "An unexpected error occurred while talking to the cloud.",
        { cause: error }
      );
  }
}
