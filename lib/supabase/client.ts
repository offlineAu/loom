"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * The one browser-side Supabase client. Only ever holds the public
 * anon/publishable key — never import anything service-role/secret into a
 * module reachable from client code. Nothing outside `lib/persistence/cloud`
 * and `lib/auth` should import this directly; UI components go through a
 * hook, exactly as they do for the local (Dexie) persistence path.
 *
 * Returns `null` when Supabase isn't configured (no project linked in this
 * environment) rather than throwing — callers (the auth hook, the cloud
 * repository) must treat that as "cloud features unavailable here", the
 * same shape of graceful degradation Phase 1B established for IndexedDB
 * unavailability.
 */
let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return browserClient;
}
