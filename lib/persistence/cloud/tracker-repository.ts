import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ListTrackersOptions,
  TrackerRepository,
  UpdateTrackerInput,
} from "@/lib/persistence/repositories/tracker-repository";
import type { TrackerInstance, TrackerMember } from "@/lib/platform/tracker-instance";
import { generateId, type Ulid } from "@/lib/platform/ids";
import { PersistenceNotFoundError } from "@/lib/persistence/errors";
import { wrapSupabaseError } from "@/lib/persistence/cloud/errors";

type TrackerRow = Database["public"]["Tables"]["trackers"]["Row"];
type TrackerMemberRow = Database["public"]["Tables"]["tracker_members"]["Row"];
type TrackerWithMembers = TrackerRow & { tracker_members: TrackerMemberRow[] };

const SELECT_WITH_MEMBERS = "*, tracker_members(*)";

function rowToInstance(row: TrackerWithMembers): TrackerInstance {
  const members: TrackerMember[] = row.tracker_members.map((m) => ({ userId: m.user_id, role: m.role }));
  return {
    id: row.id as Ulid,
    templateKey: row.template_key,
    name: row.name,
    members,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/**
 * Cloud counterpart to `DexieTrackerRepository`, implementing the exact same
 * `TrackerRepository` contract so hooks/UI never need to know which backend
 * they're talking to beyond choosing which hook to call. Every failure is
 * funneled through `wrapSupabaseError` — no raw PostgrestError/AuthError
 * ever reaches a caller.
 *
 * Creation is NOT a plain `.insert()` — it always goes through the
 * `create_tracker` RPC (see the migration), which is the only place a
 * tracker and its owner membership are ever created atomically, with
 * ownership derived from the server-side session, never from anything this
 * class sends.
 */
export class SupabaseTrackerRepository implements TrackerRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: { templateKey: string; name: string }): Promise<TrackerInstance> {
    const trackerId = generateId();
    const memberId = generateId();

    const { error } = await this.client.rpc("create_tracker", {
      p_tracker_id: trackerId,
      p_member_id: memberId,
      p_template_key: input.templateKey,
      p_name: input.name,
      p_settings: {},
    });

    if (error) {
      throw wrapSupabaseError(error);
    }

    const created = await this.getById(trackerId);
    if (!created) {
      // Cannot happen in practice (the RPC just committed this row) — same
      // defensive guard as the Dexie repository's equivalent case.
      throw new PersistenceNotFoundError(`No tracker found with id "${trackerId}" immediately after creation.`);
    }
    return created;
  }

  async getById(id: Ulid): Promise<TrackerInstance | null> {
    const { data, error } = await this.client
      .from("trackers")
      .select(SELECT_WITH_MEMBERS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw wrapSupabaseError(error);
    }
    if (!data) {
      return null;
    }
    return rowToInstance(data as TrackerWithMembers);
  }

  async list(options: ListTrackersOptions = {}): Promise<TrackerInstance[]> {
    let query = this.client.from("trackers").select(SELECT_WITH_MEMBERS);

    if (options.templateKey) {
      query = query.eq("template_key", options.templateKey);
    }
    if (!options.includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      throw wrapSupabaseError(error);
    }
    return (data as TrackerWithMembers[]).map(rowToInstance);
  }

  async update(id: Ulid, patch: UpdateTrackerInput): Promise<TrackerInstance> {
    return this.applyPatch(id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.settings !== undefined ? { settings: patch.settings } : {}),
    });
  }

  async archive(id: Ulid): Promise<TrackerInstance> {
    return this.applyPatch(id, { archived_at: new Date().toISOString() });
  }

  async restore(id: Ulid): Promise<TrackerInstance> {
    return this.applyPatch(id, { archived_at: null });
  }

  async deletePermanently(id: Ulid): Promise<void> {
    const { error } = await this.client.from("trackers").delete().eq("id", id).select().single();
    if (error) {
      throw wrapSupabaseError(error);
    }
  }

  private async applyPatch(
    id: Ulid,
    patch: Partial<Pick<TrackerRow, "name" | "settings" | "archived_at">>
  ): Promise<TrackerInstance> {
    const { data, error } = await this.client
      .from("trackers")
      .update(patch)
      .eq("id", id)
      .select(SELECT_WITH_MEMBERS)
      .single();

    if (error) {
      throw wrapSupabaseError(error);
    }
    return rowToInstance(data as TrackerWithMembers);
  }
}
