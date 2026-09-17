import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/LandingPage";
import { getCurrentUser } from "@/lib/services/auth.service";
import * as organizationService from "@/lib/services/organization.service";

/**
 * Two jobs, decided by whether anyone is signed in.
 *
 * A signed-out visitor gets the public page — for this project that is the
 * only screen most people will ever load, so it has to explain the system
 * without assuming they will click anything.
 *
 * A signed-in user never sees it. They are routed to their organization, or to
 * organization creation if they have none, before anything renders.
 */

export const metadata: Metadata = {
  title: {
    absolute: "Lapse — know before it expires",
  },
  description:
    "Lapse reads permits, registrations and insurance policies, works out when each one expires, and chases the person answerable for it. When it is not sure what it has read, it stops and asks a human instead of guessing.",
  openGraph: {
    title: "Lapse — know before it expires",
    description:
      "Compliance document expiry monitoring. Reads the document, refuses to trust itself when uncertain, and escalates before anything lapses.",
    type: "website",
  },
};

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <LandingPage />;
  }

  const organizations = await organizationService.listMine();

  if (organizations.length === 0) {
    redirect("/new-organization");
  }

  redirect(`/${organizations[0].slug}/dashboard`);
}
