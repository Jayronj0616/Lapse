import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";
import { SIGNED_IN_HOME } from "@/lib/utils/routes";

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
 * Reachable without a session, and *not* redirected away from when signed in.
 *
 * Two different reasons appear here:
 *
 * `/invite` — invitation links have to work in both states. A new recipient
 * needs to see what they have been invited to before signing up, and an
 * existing user needs to accept while already signed in. Bouncing them to `/`
 * the way `/login` does would make an invitation impossible to accept.
 *
 * `/` — the public landing page. It is the only screen most visitors to this
 * project will ever load, so it cannot sit behind the auth guard. A signed-in
 * user is redirected off it below — the page is prerendered and cannot read
 * the session itself. Listed here rather than under AUTH_PATHS because only
 * the exact path `/` is meant, not everything beneath it.
 *
 * `/api/inngest` and `/api/cron` — these are machine endpoints with their own
 * authentication: Inngest verifies a request signature, and the sweep checks
 * CRON_SECRET. Sending them through the session guard redirects them to
 * `/login`, which means Inngest can never register its functions and Vercel
 * Cron never runs the sweep — and because the sweep is also the Supabase
 * keepalive, that failure is silent until the database pauses. A 307 to a
 * login page is not something a cron job knows how to complain about.
 */
const OPEN_PATHS = ["/", "/invite", "/api/inngest", "/api/cron", "/api/op"];

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

  // A signed-in user has nothing to do on the sign-in pages or the landing
  // page. `/` used to make this decision while rendering, which forced it to
  // render on every request; deciding here lets it be served prerendered.
  if (user && (isAuthPath || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = SIGNED_IN_HOME;
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
