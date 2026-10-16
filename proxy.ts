import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Every route except static assets and the Next.js image optimizer —
     * this only refreshes the session cookie, it never redirects or gates
     * access, so running it broadly is safe for a public-first app.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)",
  ],
};
