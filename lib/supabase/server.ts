import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * A fresh Supabase client for one server-side render (Server Component,
 * Route Handler, or Server Action). Per Supabase's own guidance, a new
 * client is created per request rather than reused as a singleton — the
 * `server-only` import guarantees this file (and anything importing it) can
 * never be pulled into a client bundle by mistake.
 *
 * Uses only the public anon key (never the service_role/secret key) — RLS,
 * not this client's credentials, is what makes cloud reads/writes safe.
 */
export async function createSupabaseServerClient(): Promise<ReturnType<typeof createServerClient<Database>>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies can't be
          // written — safe to ignore because the middleware below refreshes
          // the session on every request anyway.
        }
      },
    },
  });
}
