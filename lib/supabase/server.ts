import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Runs as the signed-in user via the session cookie, so **RLS is enforced**.
 * This is the client almost everything should use — services take it and let
 * Postgres decide what the caller may see.
 *
 * `cookies()` is async in Next 16, so this function is async too.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
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
          // Server Components cannot set cookies. That is fine and expected:
          // the middleware refreshes the session on every request, so a write
          // attempted from a render pass is redundant rather than lost.
          // Swallowing it here is what keeps reads working in RSC.
        }
      },
    },
  });
}
