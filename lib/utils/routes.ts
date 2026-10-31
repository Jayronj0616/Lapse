/**
 * Where a signed-in user goes when nothing more specific was asked for: after
 * sign-in, after sign-up, and when they land on `/` or an auth page.
 *
 * `/new-organization` is the page that already makes this decision — it sends
 * anyone with an organization to that organization's dashboard and shows the
 * onboarding form to anyone without one.
 *
 * Not `/`. The landing page is prerendered so it can be served from the CDN,
 * which means it cannot read the session. The proxy bounces a signed-in
 * visitor off it, but a Server Action's `redirect()` renders its destination
 * inside the action response without passing through the proxy — so
 * `redirect("/")` after signing in would show a signed-in user the marketing
 * page. Actions redirect here directly instead.
 */
export const SIGNED_IN_HOME = "/new-organization";
