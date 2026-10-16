/**
 * Hand-authored, kept in exact lockstep with
 * supabase/migrations/20260909070434_platform_schema.sql — the single
 * source of truth is that SQL file, not this file.
 *
 * The normal, preferred workflow is `supabase gen types typescript --linked`
 * (or `--db-url`) against a real/local Supabase project so these types are
 * mechanically derived and can never drift from the schema. That path
 * requires Docker (the Supabase CLI's local/db-url type generation shells
 * out to a Docker-based introspection step) or a linked hosted project with
 * an access token — neither is available in this environment (no Docker,
 * no live Supabase project/credentials). See
 * docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md ("Types") for the exact command to
 * run once either becomes available, which should replace this file
 * wholesale rather than be merged with it.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trackers: {
        Row: {
          id: string;
          template_key: string;
          name: string;
          settings: Record<string, unknown>;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          template_key: string;
          name: string;
          settings?: Record<string, unknown>;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_key?: string;
          name?: string;
          settings?: Record<string, unknown>;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tracker_members: {
        Row: {
          id: string;
          tracker_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tracker_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tracker_id?: string;
          user_id?: string;
          role?: "owner" | "editor" | "viewer";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracker_members_tracker_id_fkey";
            columns: ["tracker_id"];
            isOneToOne: false;
            referencedRelation: "trackers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_tracker: {
        Args: {
          p_tracker_id: string;
          p_member_id: string;
          p_template_key: string;
          p_name: string;
          p_settings?: Record<string, unknown>;
        };
        Returns: Database["public"]["Tables"]["trackers"]["Row"];
      };
      my_tracker_role: {
        Args: { p_tracker_id: string };
        Returns: "owner" | "editor" | "viewer" | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
