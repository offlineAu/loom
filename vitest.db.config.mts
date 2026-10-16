import { defineConfig } from "vitest/config";

/**
 * Separate Vitest project for tests/db/**: these boot a real, disposable
 * PostgreSQL instance per file (via `embedded-postgres`) to prove the RLS
 * policies under supabase/migrations/ actually reject unauthorized queries.
 * Kept out of the default `vitest run` (vitest.config.mts only includes
 * tests/unit and tests/component) since starting Postgres takes real wall
 * time and these are database tests, not fast unit tests — run explicitly
 * via `npm run test:db`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
