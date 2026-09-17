import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Next 16 renamed the `middleware` convention to `proxy`. Same behaviour, and
 * still one file per project — route-specific logic is imported in, not split
 * across several proxy files.
 *
 * This does two jobs on every request: refresh the Supabase session, and gate
 * access. Note what it is not doing — it makes no authorization decisions about
 * *data*. That is RLS's job. This only answers "is anyone signed in".
 */

/**
 * Sign-in and sign-up. Reachable without a session, and a signed-in visitor is
 * bounced away from them — there is nothing for them there.
 */
const AUTH_PATHS = ["/login", "/signup", "/auth"];

/**
 * Reachable without a session, but *not* redirected away from when signed in.
 *
 * Invitation links have to work in both states: a new recipient needs to see
 * what they have been invited to before signing up, and an existing user needs
 * to be able to accept while already signed in. Bouncing them to `/` the way
 * `/login` does would make an invitation impossible to accept.
 */
const OPEN_PATHS = ["/invite"];

function matches(paths: string[], pathname: string): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthPath = matches(AUTH_PATHS, pathname);
  const isOpenPath = matches(OPEN_PATHS, pathname);

  if (!user && !isAuthPath && !isOpenPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Remember where they were headed so login can return them to it.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Everything except Next's own assets and static image files. The session
    // refresh has to run broadly; skipping it on a route means a session that
    // silently goes stale there.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
