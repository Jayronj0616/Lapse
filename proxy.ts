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
 * Routes reachable without a session. Everything else requires one — the guard
 * is deny-by-default, so a new route is protected the moment it exists rather
 * than the moment someone remembers to protect it.
 */
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Remember where they were headed so login can return them to it.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublic(pathname)) {
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
