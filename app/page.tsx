import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/LandingPage";

/**
 * The public landing page. For this project it is the only screen most people
 * will ever load, so it has to explain the system without assuming they will
 * click anything — and it has to load fast.
 *
 * It is prerendered at build time and served from the CDN. That is why it
 * reads nothing about the visitor: a single session read here (cookies, the
 * Supabase user) would make every request render on the server again.
 *
 * A signed-in user never sees it. The proxy redirects them to SIGNED_IN_HOME
 * before this page is served — see proxy.ts.
 */

// Fail the build rather than quietly going back to rendering per request if
// something request-specific is ever added to this page.
export const dynamic = "error";

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

export default function RootPage() {
  return <LandingPage />;
}
