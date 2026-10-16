/**
 * The two browser-safe Supabase values. Neither is a secret — the "anon"
 * (in newer Supabase dashboards, "publishable") key is designed to be
 * shipped to the client; every real access boundary is RLS, not this key.
 * See docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md ("Environment") for what must
 * NEVER be exposed this way (the service_role/secret key).
 *
 * LOOM stays fully usable with neither set — the anonymous/local (Dexie)
 * path never touches these. Every cloud-facing call site must check
 * `isSupabaseConfigured()` first; the getters below throw only once that
 * check has already passed, so a thrown error here is a programming
 * mistake, never a user-facing crash on an unconfigured deployment.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.local.example to .env.local and fill in your Supabase project's values, or check isSupabaseConfigured() before calling this."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.local.example to .env.local and fill in your Supabase project's values, or check isSupabaseConfigured() before calling this."
    );
  }
  return key;
}
