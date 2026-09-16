import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Plus } from "lucide-react";

import { ExceptionGroup } from "@/components/dashboard/ExceptionGroup";
import { buttonVariants } from "@/components/ui/button";
import * as documentService from "@/lib/services/document.service";
import * as organizationService from "@/lib/services/organization.service";
import { daysUntil } from "@/lib/utils/dates";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The exceptions screen: what needs a human right now, most urgent first.
 *
 * Groups that are empty do not render at all — an organization with nothing
 * expired should not have to scroll past an empty "Expired" heading to find
 * the thing that is due next.
 *
 * Absent for now, and deliberately: awaiting-review, extraction-failed, and
 * the sweep heartbeat. None of those states can occur until the phases that
 * produce them exist, so showing empty bands for them would be inventing work.
 */
export default async function DashboardPage({
  params,
}: PageProps<"/[orgSlug]/dashboard">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const documents = await documentService.listForOrganization(organization.id);

  const tracked = documents.filter(
    (document) =>
      document.expiry_date !== null && document.status !== "archived",
  );

  const withinDays = (from: number, to: number) =>
    tracked.filter((document) => {
      const days = daysUntil(document.expiry_date as string);
      return days >= from && days <= to;
    });

  const expired = tracked.filter(
    (document) => daysUntil(document.expiry_date as string) < 0,
  );
  const urgent = withinDays(0, 7);
  const soon = withinDays(8, 30);
  const upcoming = withinDays(31, 60);

  // Not on the expiry timeline at all — these are blocked rather than close to
  // lapsing, and a blocked document has an unknown deadline, which is worse
  // than a known one.
  const awaitingReview = documents.filter(
    (document) => document.status === "needs_review",
  );
  const failed = documents.filter(
    (document) => document.status === "extraction_failed",
  );

  const nothingToDo =
    expired.length +
      awaitingReview.length +
      failed.length +
      urgent.length +
      soon.length +
      upcoming.length ===
    0;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything that needs attention, in one place.
          </p>
        </div>
        <Link
          href={`/${organization.slug}/documents/upload`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Plus className="size-4" />
          Add document
        </Link>
      </div>

      {nothingToDo ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Check className="size-8 text-status-ok" aria-hidden />
          <p className="mt-4 text-sm font-medium">Nothing to act on</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {documents.length === 0
              ? "Once documents are being tracked, anything expiring or expired will surface here."
              : "Nothing expires in the next 60 days."}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <ExceptionGroup
            title="Expired"
            description="Already lapsed. Whatever these cover is not currently legal to operate."
            documents={expired}
            orgSlug={organization.slug}
          />
          <ExceptionGroup
            title="Awaiting review"
            description="The model was not confident enough to accept these on its own. Until someone settles them, their real expiry is unknown."
            documents={awaitingReview}
            orgSlug={organization.slug}
            href={`/${organization.slug}/review`}
          />
          <ExceptionGroup
            title="Extraction failed"
            description="These could not be read at all. Open each one and enter its dates by hand."
            documents={failed}
            orgSlug={organization.slug}
          />
          <ExceptionGroup
            title="Expiring within 7 days"
            description="Renewal needs to be in motion now."
            documents={urgent}
            orgSlug={organization.slug}
          />
          <ExceptionGroup
            title="Expiring within 30 days"
            description="Start the renewal before it becomes urgent."
            documents={soon}
            orgSlug={organization.slug}
          />
          <ExceptionGroup
            title="Expiring within 60 days"
            description="On the horizon. Nothing to do yet."
            documents={upcoming}
            orgSlug={organization.slug}
          />
        </div>
      )}
    </main>
  );
}
