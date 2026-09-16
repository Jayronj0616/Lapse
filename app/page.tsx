import { redirect } from "next/navigation";

import * as organizationService from "@/lib/services/organization.service";

/**
 * Entry point for a signed-in user.
 *
 * The middleware guarantees a session before this renders, so the only question
 * left is where to send them: their first organization, or onboarding if they
 * do not have one yet. This page never renders anything — it only routes.
 */
export default async function RootPage() {
  const organizations = await organizationService.listMine();

  if (organizations.length === 0) {
    redirect("/new-organization");
  }

  redirect(`/${organizations[0].slug}/dashboard`);
}
