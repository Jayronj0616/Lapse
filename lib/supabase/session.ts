import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Refreshes the Supabase session on every request and reports who is signed in.
 *
 * Server Components cannot write cookies, so a session that expires mid-visit
 * would never be refreshed from a render pass. The proxy (Next 16's name for
 * what used to be middleware) is the only place in a Next app that can both
 * read and write them, which is why session refresh lives here and
 * `lib/supabase/server.ts` silently swallows its cookie writes.
 *
 * The cookie dance below looks redundant and is not: cookies are written onto
 * the *request* first so anything downstream in this same pass sees the fresh
 * session, then the response is rebuilt so they also reach the browser.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Must be getUser(), not getSession(). getSession() trusts whatever is in the
  // cookie; getUser() revalidates the token against Supabase. Since this call
  // is what the auth guard decides on, trusting the cookie would mean trusting
  // a value the browser can edit.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
