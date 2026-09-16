import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Supabase client for Client Components.
 *
 * Runs as the signed-in user, so every query is subject to RLS. This is the
 * only Supabase client that is allowed to reach the browser.
 *
 * Reminder from CLAUDE.md: components do not query the database directly.
 * This exists for auth calls (sign in, sign out, session listening) and for
 * realtime subscriptions — not for reading application data. That goes through
 * a service, called from a Server Component or a Server Action.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
