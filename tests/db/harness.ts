import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const AUTH_STUB_SQL = fs.readFileSync(path.join(__dirname, "auth-stub.sql"), "utf-8");
const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");

function loadMigrations(): { name: string; sql: string }[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({ name: file, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8") }));
}

/**
 * Boots a real, disposable PostgreSQL instance (via `embedded-postgres` —
 * an actual `postgres.exe`/`initdb.exe`, not a mock or an in-memory stand-in)
 * and applies the exact SQL under `supabase/migrations/` unmodified, plus a
 * test-only stand-in for the slice of Supabase's `auth` schema those
 * migrations depend on (see auth-stub.sql).
 *
 * This validates the *policy logic* under real PostgreSQL RLS enforcement —
 * genuine unauthorized queries are actually rejected by the database, not
 * merely "the policies compiled". It does NOT exercise GoTrue, PostgREST, or
 * the Supabase client SDK's network/session layer — see
 * docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md ("What the RLS tests do and don't
 * prove") for the precise boundary.
 */
export class RlsTestDatabase {
  private constructor(
    private readonly pg: EmbeddedPostgres,
    private readonly dataDir: string,
    private readonly port: number
  ) {}

  static async start(): Promise<RlsTestDatabase> {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loom-rls-test-"));
    const port = 40000 + Math.floor(Math.random() * 10000);

    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "postgres",
      password: "postgres",
      port,
      persistent: false,
      onLog: () => {},
      onError: () => {},
    });

    await pg.initialise();
    await pg.start();
    await pg.createDatabase("loom_test");

    const harness = new RlsTestDatabase(pg, dataDir, port);
    await harness.applySchema();
    return harness;
  }

  private async applySchema(): Promise<void> {
    const client = await this.rawAdminClient();
    try {
      await client.query(AUTH_STUB_SQL);
      for (const migration of loadMigrations()) {
        try {
          await client.query(migration.sql);
        } catch (error) {
          throw new Error(`Migration ${migration.name} failed to apply: ${(error as Error).message}`, {
            cause: error,
          });
        }
      }
    } finally {
      await client.end();
    }
  }

  private async rawAdminClient(): Promise<Client> {
    const client = new Client({
      host: "127.0.0.1",
      port: this.port,
      user: "postgres",
      password: "postgres",
      database: "loom_test",
    });
    await client.connect();
    return client;
  }

  /** A connection with full (table-owner) privileges — used only for test fixture setup, never to make an assertion about what a user can/can't do. */
  async asAdmin(): Promise<Client> {
    return this.rawAdminClient();
  }

  /** A connection exactly as an anonymous (unauthenticated) API caller would be scoped in real Supabase — the `anon` role, no JWT claims. */
  async asAnon(): Promise<Client> {
    const client = await this.rawAdminClient();
    await client.query("set role anon");
    return client;
  }

  /** A connection scoped exactly as PostgREST would scope a request bearing a valid JWT for this user — `authenticated` role, `auth.uid()` resolving to `userId`. */
  async asUser(userId: string): Promise<Client> {
    const client = await this.rawAdminClient();
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    return client;
  }

  /** Inserts a row directly into the auth.users stand-in, exercising the real handle_new_user profile-bootstrap trigger. Returns the new user's id. */
  async createTestUser(email: string): Promise<string> {
    const client = await this.rawAdminClient();
    try {
      const result = await client.query<{ id: string }>(
        "insert into auth.users (email) values ($1) returning id",
        [email]
      );
      return result.rows[0].id;
    } finally {
      await client.end();
    }
  }

  async stop(): Promise<void> {
    await this.pg.stop();
    fs.rmSync(this.dataDir, { recursive: true, force: true });
  }
}
