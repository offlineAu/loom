"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User; profile: ProfileRow | null };

/**
 * The one place UI components go to read/react to the current Supabase auth
 * session — components never call `supabase.auth.*` directly, mirroring the
 * Phase 1B rule that UI never talks to a persistence backend directly.
 *
 * `"unconfigured"` (no Supabase project linked in this environment) is a
 * distinct, first-class state from `"signed-out"` — the account page uses it
 * to explain honestly why cloud sign-in isn't available here, rather than
 * silently failing or pretending sign-in works.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const loadProfile = useCallback(async (user: User) => {
    const client = getSupabaseBrowserClient();
    if (!client) return null;
    const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data;
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      // Whether Supabase is configured is static for the life of the page
      // (it's read from env vars, not from any prop/state), so this isn't a
      // cascade — it's a one-time classification of an external precondition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "unconfigured" });
      return;
    }

    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setState({ status: "signed-out" });
        return;
      }
      const profile = await loadProfile(user);
      if (!cancelled) {
        setState({ status: "signed-in", user, profile });
      }
    })();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({ status: "signed-out" });
        return;
      }
      loadProfile(session.user).then((profile) => {
        if (!cancelled) {
          setState({ status: "signed-in", user: session.user, profile });
        }
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithOtp = useCallback(async (email: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Cloud accounts aren't configured in this environment.");
    }
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    await client.auth.signOut();
    setState({ status: "signed-out" });
  }, []);

  const renameProfile = useCallback(
    async (displayName: string) => {
      const client = getSupabaseBrowserClient();
      if (!client || state.status !== "signed-in") return;
      const { data } = await client
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", state.user.id)
        .select()
        .single();
      if (data) {
        setState({ status: "signed-in", user: state.user, profile: data });
      }
    },
    [state]
  );

  return { ...state, signInWithOtp, signOut, renameProfile };
}
