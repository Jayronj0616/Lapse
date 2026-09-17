/**
 * The application's own origin, for links that leave the app.
 *
 * Invitation links and reminder emails have to carry an absolute URL, and
 * getting it wrong is silent: the email sends, the link renders, and it points
 * at `localhost` on somebody else's machine. Nothing errors.
 *
 * Resolution order, and the reasoning:
 *
 *   1. `NEXT_PUBLIC_APP_URL` — an explicit setting always wins, which is what
 *      you want for a custom domain.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — the project's stable production host,
 *      set by Vercel. Not `VERCEL_URL`, which is unique per deployment: a link
 *      built from that one dies as soon as the next deploy supersedes it, and
 *      an invitation is valid for fourteen days.
 *   3. localhost, for development.
 *
 * Server-side only. `VERCEL_PROJECT_PRODUCTION_URL` is not exposed to the
 * browser, and every caller here runs on the server.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
