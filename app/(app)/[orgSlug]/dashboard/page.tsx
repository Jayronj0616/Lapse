import type { Metadata } from "next";
import { Inbox } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The exceptions screen. Its job is to answer "what needs a human right now"
 * above the fold — see DESIGN.md.
 *
 * Empty until there is something to be excepted about. The real groups
 * (expiring, expired, awaiting review, extraction failed, unacknowledged
 * reminders, stale heartbeat) arrive with the phases that produce them; there
 * is deliberately no upload button here yet, because upload does not exist
 * until Phase 2.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything that needs attention, in one place.
      </p>

      <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <Inbox className="size-8 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-sm font-medium">Nothing to act on</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Once documents are being tracked, anything expiring, expired or
          waiting on review will surface here.
        </p>
      </div>
    </main>
  );
}
