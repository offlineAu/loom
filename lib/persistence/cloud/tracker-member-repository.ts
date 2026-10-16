import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { TrackerMemberRepository } from "@/lib/persistence/repositories/tracker-member-repository";
import type { TrackerMemberRow } from "@/lib/persistence/types/rows";
import type { Ulid } from "@/lib/platform/ids";
import { wrapSupabaseError } from "@/lib/persistence/cloud/errors";

type CloudTrackerMemberRow = Database["public"]["Tables"]["tracker_members"]["Row"];

function toTrackerMemberRow(row: CloudTrackerMemberRow): TrackerMemberRow {
  return {
    id: row.id,
    trackerId: row.tracker_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Cloud counterpart to `DexieTrackerMemberRepository`, mapping Supabase's
 * snake_case columns to the same camelCase `TrackerMemberRow` shape the
 * local repository returns so callers of the shared interface never see a
 * difference. There is no `createWithinTransaction` here (unlike the local
 * one) — cloud membership is only ever created either by
 * `create_tracker()`'s owner row or by an owner's direct `tracker_members`
 * insert (both RLS/RPC-governed, not a concern of this read-focused
 * repository).
 */
export class SupabaseTrackerMemberRepository implements TrackerMemberRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listByTracker(trackerId: Ulid): Promise<TrackerMemberRow[]> {
    const { data, error } = await this.client.from("tracker_members").select("*").eq("tracker_id", trackerId);
    if (error) {
      throw wrapSupabaseError(error);
    }
    return data.map(toTrackerMemberRow);
  }

  async listByUser(userId: string): Promise<TrackerMemberRow[]> {
    const { data, error } = await this.client.from("tracker_members").select("*").eq("user_id", userId);
    if (error) {
      throw wrapSupabaseError(error);
    }
    return data.map(toTrackerMemberRow);
  }

  async getOwner(trackerId: Ulid): Promise<TrackerMemberRow | undefined> {
    const members = await this.listByTracker(trackerId);
    return members.find((member) => member.role === "owner");
  }
}
