import { describe, expect, it, vi } from "vitest";
import { SupabaseTrackerRepository } from "@/lib/persistence/cloud/tracker-repository";
import { SupabaseTrackerMemberRepository } from "@/lib/persistence/cloud/tracker-member-repository";
import { PersistenceNotFoundError } from "@/lib/persistence/errors";
import { generateId } from "@/lib/platform/ids";

/**
 * A minimal, hand-rolled double for the slice of the Supabase JS query
 * builder these two repositories actually call. It is intentionally not a
 * faithful PostgREST client — the real request/response behavior (and,
 * critically, the RLS policies) are proven for real in tests/db/rls.test.ts
 * against actual PostgreSQL. This double exists only to verify this
 * repository layer's own logic: request shaping, response-to-domain-model
 * mapping, and error wrapping — the same division of labor Phase 1B used
 * (fake-indexeddb for the real engine, plain unit tests for repository
 * logic), adapted here because there is no in-memory PostgREST equivalent
 * of fake-indexeddb.
 */
function makeFakeClient(responseByTable: Record<string, { data: unknown; error: unknown }>, rpcResponse?: { data: unknown; error: unknown }) {
  function builder(table: string) {
    const chain: PromiseLike<{ data: unknown; error: unknown }> = {
      then(onfulfilled, onrejected) {
        return Promise.resolve(responseByTable[table]).then(onfulfilled, onrejected);
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self: any = chain;
    for (const method of ["select", "eq", "is", "order", "update", "delete", "insert"]) {
      self[method] = vi.fn(() => self);
    }
    self.single = vi.fn(() => chain);
    self.maybeSingle = vi.fn(() => chain);
    return self;
  }

  return {
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(() => Promise.resolve(rpcResponse ?? { data: null, error: null })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("SupabaseTrackerRepository", () => {
  it("getById maps a row with embedded tracker_members to a TrackerInstance", async () => {
    const trackerId = generateId();
    const client = makeFakeClient({
      trackers: {
        data: {
          id: trackerId,
          template_key: "cloud-preview",
          name: "My Cloud Tracker",
          settings: {},
          archived_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          tracker_members: [
            {
              id: generateId(),
              tracker_id: trackerId,
              user_id: "11111111-1111-4111-8111-111111111111",
              role: "owner",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
        error: null,
      },
    });

    const repository = new SupabaseTrackerRepository(client);
    const result = await repository.getById(trackerId);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("My Cloud Tracker");
    expect(result?.members).toHaveLength(1);
    expect(result?.members[0]).toEqual({ userId: "11111111-1111-4111-8111-111111111111", role: "owner" });
  });

  it("getById returns null when the row is absent (not found, or RLS-filtered)", async () => {
    const client = makeFakeClient({ trackers: { data: null, error: null } });
    const repository = new SupabaseTrackerRepository(client);
    expect(await repository.getById(generateId())).toBeNull();
  });

  it("wraps a PGRST116 error from .single() into PersistenceNotFoundError on update", async () => {
    const client = makeFakeClient({ trackers: { data: null, error: { code: "PGRST116", message: "no rows" } } });
    const repository = new SupabaseTrackerRepository(client);
    await expect(repository.update(generateId(), { name: "x" })).rejects.toBeInstanceOf(PersistenceNotFoundError);
  });

  it("list() maps every row and does not include an is()/eq() filter mismatch", async () => {
    const trackerId = generateId();
    const client = makeFakeClient({
      trackers: {
        data: [
          {
            id: trackerId,
            template_key: "cloud-preview",
            name: "A",
            settings: {},
            archived_at: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            tracker_members: [],
          },
        ],
        error: null,
      },
    });
    const repository = new SupabaseTrackerRepository(client);
    const result = await repository.list({ templateKey: "cloud-preview" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(trackerId);
  });
});

describe("SupabaseTrackerRepository.create", () => {
  it("calls create_tracker via RPC, then reads back the full instance (never a direct .insert())", async () => {
    const client = makeFakeClient(
      {
        trackers: {
          data: {
            id: "placeholder",
            template_key: "cloud-preview",
            name: "Brand New",
            settings: {},
            archived_at: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            tracker_members: [
              {
                id: generateId(),
                tracker_id: "placeholder",
                user_id: "55555555-5555-4555-8555-555555555555",
                role: "owner",
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
          error: null,
        },
      },
      { data: { id: "placeholder" }, error: null }
    );

    const repository = new SupabaseTrackerRepository(client);
    const result = await repository.create({ templateKey: "cloud-preview", name: "Brand New" });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_tracker",
      expect.objectContaining({ p_template_key: "cloud-preview", p_name: "Brand New" })
    );
    expect(result.name).toBe("Brand New");
    expect(result.members[0].role).toBe("owner");
  });
});

describe("SupabaseTrackerMemberRepository", () => {
  it("maps snake_case columns to the shared camelCase TrackerMemberRow shape", async () => {
    const trackerId = generateId();
    const memberId = generateId();
    const client = makeFakeClient({
      tracker_members: {
        data: [
          {
            id: memberId,
            tracker_id: trackerId,
            user_id: "22222222-2222-4222-8222-222222222222",
            role: "editor",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
    });
    const repository = new SupabaseTrackerMemberRepository(client);
    const result = await repository.listByTracker(trackerId);
    expect(result).toEqual([
      {
        id: memberId,
        trackerId,
        userId: "22222222-2222-4222-8222-222222222222",
        role: "editor",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("getOwner finds the owner among listed members", async () => {
    const trackerId = generateId();
    const client = makeFakeClient({
      tracker_members: {
        data: [
          {
            id: generateId(),
            tracker_id: trackerId,
            user_id: "33333333-3333-4333-8333-333333333333",
            role: "viewer",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: generateId(),
            tracker_id: trackerId,
            user_id: "44444444-4444-4444-8444-444444444444",
            role: "owner",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
    });
    const repository = new SupabaseTrackerMemberRepository(client);
    const owner = await repository.getOwner(trackerId);
    expect(owner?.userId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
