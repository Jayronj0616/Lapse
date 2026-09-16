import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCheck } from "lucide-react";

import { ReviewCard } from "@/components/review/ReviewCard";
import * as documentService from "@/lib/services/document.service";
import * as organizationService from "@/lib/services/organization.service";
import * as reviewService from "@/lib/services/review.service";

export const metadata: Metadata = {
  title: "Review",
};

export default async function ReviewPage({
  params,
}: PageProps<"/[orgSlug]/review">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const items = await reviewService.listPending(organization.id);

  // Signed per request and short-lived, so they cannot be generated once and
  // cached. A file that fails to sign yields a null rather than taking the
  // whole queue down with it.
  const fileUrls = await Promise.all(
    items.map(async (item) => {
      try {
        return await documentService.signedFileUrl(item.storage_path, 900);
      } catch {
        return null;
      }
    }),
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Documents the model was not confident enough about to accept on its own.
        Oldest first — a queue sorted by confidence is one where the least
        certain documents never get reached.
      </p>

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CheckCheck className="size-8 text-status-ok" aria-hidden />
          <p className="mt-4 text-sm font-medium">Nothing waiting on you</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Uploads that the model reads confidently go straight to tracking.
            Anything it is unsure about appears here.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {items.map((item, index) => (
            <ReviewCard
              key={item.id}
              item={item}
              fileUrl={fileUrls[index]}
              orgSlug={organization.slug}
            />
          ))}
        </div>
      )}
    </main>
  );
}
