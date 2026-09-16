import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { UploadDocumentForm } from "@/components/documents/UploadDocumentForm";
import * as organizationService from "@/lib/services/organization.service";
import * as subjectService from "@/lib/services/subject.service";

export const metadata: Metadata = {
  title: "Add document",
};

export default async function UploadDocumentPage({
  params,
}: PageProps<"/[orgSlug]/documents/upload">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const subjects = await subjectService.listForOrganization(organization.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <Link
        href={`/${organization.slug}/documents`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Documents
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Add document
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Attach the file. Leave the dates blank and Lapse reads them off the
        document itself — anything it is unsure about goes to review rather
        than being trusted.
      </p>

      <div className="mt-8">
        <UploadDocumentForm
          orgSlug={organization.slug}
          subjects={subjects}
        />
      </div>
    </main>
  );
}
