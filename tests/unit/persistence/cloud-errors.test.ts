import { describe, expect, it } from "vitest";
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
import { wrapSupabaseError } from "@/lib/persistence/cloud/errors";

describe("wrapSupabaseError", () => {
  it("passes an already-wrapped PersistenceError through unchanged", () => {
    const original = new PersistenceNotFoundError("already wrapped");
    expect(wrapSupabaseError(original)).toBe(original);
  });

  it("maps a bare TypeError (fetch failure) to PersistenceNetworkError", () => {
    expect(wrapSupabaseError(new TypeError("Failed to fetch"))).toBeInstanceOf(PersistenceNetworkError);
  });

  it("maps PGRST116 (no/multiple rows for .single()) to PersistenceNotFoundError", () => {
    expect(wrapSupabaseError({ code: "PGRST116", message: "no rows" })).toBeInstanceOf(PersistenceNotFoundError);
  });

  it("maps 42501 (insufficient_privilege) to PersistenceAuthorizationError", () => {
    expect(wrapSupabaseError({ code: "42501", message: "denied" })).toBeInstanceOf(PersistenceAuthorizationError);
  });

  it("maps 28000 (invalid_authorization_specification) to PersistenceUnauthenticatedError", () => {
    expect(wrapSupabaseError({ code: "28000", message: "not authenticated" })).toBeInstanceOf(
      PersistenceUnauthenticatedError
    );
  });

  it("maps 23505 (unique_violation) to PersistenceConstraintError", () => {
    expect(wrapSupabaseError({ code: "23505", message: "duplicate" })).toBeInstanceOf(PersistenceConstraintError);
  });

  it("maps 23503 (foreign_key_violation) to PersistenceConstraintError", () => {
    expect(wrapSupabaseError({ code: "23503", message: "fk violation" })).toBeInstanceOf(PersistenceConstraintError);
  });

  it("maps 23514 (check_violation) to PersistenceValidationError", () => {
    expect(wrapSupabaseError({ code: "23514", message: "check failed" })).toBeInstanceOf(PersistenceValidationError);
  });

  it("maps 22023 (invalid_parameter_value, raised by create_tracker's own checks) to PersistenceValidationError", () => {
    expect(wrapSupabaseError({ code: "22023", message: "bad input" })).toBeInstanceOf(PersistenceValidationError);
  });

  it("falls back to PersistenceTransactionError for an unrecognized error shape", () => {
    const wrapped = wrapSupabaseError({ code: "99999", message: "something else" });
    expect(wrapped).toBeInstanceOf(PersistenceTransactionError);
    expect(wrapped).toBeInstanceOf(PersistenceError);
  });

  it("falls back to PersistenceTransactionError for a value with no code at all", () => {
    expect(wrapSupabaseError(new Error("boom"))).toBeInstanceOf(PersistenceTransactionError);
  });
});
