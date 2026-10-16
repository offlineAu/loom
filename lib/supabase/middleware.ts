import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase auth session cookie on every matched request. This
 * is session upkeep only — it never redirects, never blocks a request, and
 * never requires authentication. LOOM stays public-first: every route this
 * middleware runs on is exactly as reachable anonymously afterward as
 * before. See docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md ("Authentication UX").
 *
 * A no-op (plain pass-through, no Supabase client constructed at all) when
 * no project is configured in this environment — this is what keeps
 * `npm run build`/`next start` working with zero env vars set.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers a token refresh (and the setAll above) if the session is
  // stale. The return value itself is intentionally unused here — this
  // middleware's only job is the cookie refresh side effect, never a
  // redirect/auth-gate decision.
  await supabase.auth.getUser();

  return response;
}
