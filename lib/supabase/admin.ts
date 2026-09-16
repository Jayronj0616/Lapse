import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseSecretKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Privileged Supabase client. **Bypasses Row Level Security entirely.**
 *
 * There is no user session here, which means the database will not protect you
 * from a query that forgets its tenant. Every query made through this client
 * must scope `organization_id` explicitly. This is the single place in the
 * codebase where a missing filter leaks data across tenants — CLAUDE.md calls
 * it out for the same reason.
 *
 * Legitimate callers, and no others:
 *   - Inngest jobs in lib/jobs/, which run without a request
 *   - the daily sweep behind /api/cron/sweep
 *   - migrations and seed scripts
 *
 * If you are reaching for this from a page, a component or a Server Action
 * handling a user request, you want `./server` instead. The import of
 * `server-only` makes an accidental client import a build error rather than a
 * production incident.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: {
      // No session to persist or refresh — this client is not a user.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
