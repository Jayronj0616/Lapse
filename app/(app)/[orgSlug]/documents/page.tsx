import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Plus } from "lucide-react";

import { StatusBadge } from "@/components/documents/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import * as documentService from "@/lib/services/document.service";
import * as organizationService from "@/lib/services/organization.service";
import { formatDate } from "@/lib/utils/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document.schema";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function DocumentsPage({
  params,
}: PageProps<"/[orgSlug]/documents">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const documents = await documentService.listForOrganization(organization.id);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sorted by expiry — the next thing to lapse is at the top.
          </p>
        </div>
        <Link
          href={`/${organization.slug}/documents/upload`}
          className={buttonVariants()}
        >
          <Plus className="size-4" />
          Add document
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-medium">No documents yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add a permit, registration or policy and Lapse will track when it
            expires.
          </p>
          <Link
            href={`/${organization.slug}/documents/upload`}
            className={buttonVariants({ className: "mt-6" })}
          >
            <Plus className="size-4" />
            Add document
          </Link>
        </div>
      ) : (
        /* Cards on mobile, a table above md — a horizontally scrolling table
           on a phone is a failure, per DESIGN.md. */
        <ul className="mt-8 divide-y rounded-lg border">
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                href={`/${organization.slug}/documents/${document.id}`}
                className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-accent md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {document.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[document.type]}
                    {document.subject ? ` · ${document.subject.label}` : ""}
                    {document.expiry_date
                      ? ` · expires ${formatDate(document.expiry_date)}`
                      : ""}
                  </p>
                </div>
                <StatusBadge
                  status={document.status}
                  expiry={document.expiry_date}
                  className="shrink-0 self-start md:self-auto"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
