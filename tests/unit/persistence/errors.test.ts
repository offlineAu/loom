import { describe, expect, it } from "vitest";
import {
  PersistenceConstraintError,
  PersistenceInitializationError,
  PersistenceNotFoundError,
  PersistenceTransactionError,
  wrapPersistenceError,
} from "@/lib/persistence/errors";

function domException(name: string, message = "synthetic"): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("wrapPersistenceError", () => {
  it("passes an already-controlled PersistenceError through unchanged", () => {
    const original = new PersistenceNotFoundError("already controlled");
    expect(wrapPersistenceError(original)).toBe(original);
  });

  it("maps ConstraintError to PersistenceConstraintError", () => {
    expect(wrapPersistenceError(domException("ConstraintError"))).toBeInstanceOf(PersistenceConstraintError);
  });

  it("maps NotFoundError to PersistenceNotFoundError", () => {
    expect(wrapPersistenceError(domException("NotFoundError"))).toBeInstanceOf(PersistenceNotFoundError);
  });

  it("maps AbortError to PersistenceTransactionError", () => {
    expect(wrapPersistenceError(domException("AbortError"))).toBeInstanceOf(PersistenceTransactionError);
  });

  it("maps VersionError to PersistenceInitializationError", () => {
    expect(wrapPersistenceError(domException("VersionError"))).toBeInstanceOf(PersistenceInitializationError);
  });

  it("falls back to PersistenceTransactionError for an unrecognized error", () => {
    expect(wrapPersistenceError(new Error("something else"))).toBeInstanceOf(PersistenceTransactionError);
  });

  it("falls back to PersistenceTransactionError for a non-Error thrown value", () => {
    expect(wrapPersistenceError("a plain string was thrown")).toBeInstanceOf(PersistenceTransactionError);
  });
});
