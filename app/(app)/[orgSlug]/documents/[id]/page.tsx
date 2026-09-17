import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/components/documents/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import * as documentService from "@/lib/services/document.service";
import * as organizationService from "@/lib/services/organization.service";
import { daysUntil, describeDayGap, formatDate } from "@/lib/utils/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document.schema";

export const metadata: Metadata = {
  title: "Document",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function DocumentDetailPage({
  params,
}: PageProps<"/[orgSlug]/documents/[id]">) {
  const { orgSlug, id } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const document = await documentService.getById(id);
  // RLS already hides other organizations' documents, but a document from
  // another org the user *does* belong to would otherwise render under the
  // wrong slug.
  if (!document || document.organization_id !== organization.id) notFound();

  // Signed per request, expires in five minutes. There is no permanent URL to
  // this file by design.
  //
  // Failure here must not take the page down. Everything below — the expiry
  // date, the status, who is responsible — is worth seeing even when the file
  // itself cannot be reached, and a page that 500s tells the reader nothing
  // about which part failed. The review queue already handles it this way.
  let fileUrl: string | null = null;
  try {
    fileUrl = await documentService.signedFileUrl(document.storage_path);
  } catch (error) {
    console.error(
      `[documents] could not sign a URL for ${document.id}:`,
      error,
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <Link
        href={`/${organization.slug}/documents`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Documents
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {document.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {DOCUMENT_TYPE_LABELS[document.type]}
          </p>
        </div>
        <StatusBadge
          status={document.status}
          expiry={document.expiry_date}
          className="shrink-0"
        />
      </div>

      <dl className="mt-8 grid gap-6 rounded-lg border p-6 sm:grid-cols-2">
        <Field label="Expires">
          {document.expiry_date ? (
            <>
              <span className="tabular-nums">
                {formatDate(document.expiry_date)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {describeDayGap(daysUntil(document.expiry_date))}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Not recorded</span>
          )}
        </Field>

        <Field label="Issued">
          {document.issue_date ? (
            <span className="tabular-nums">
              {formatDate(document.issue_date)}
            </span>
          ) : (
            <span className="text-muted-foreground">Not recorded</span>
          )}
        </Field>

        <Field label="Covers">
          {document.subject ? (
            <>
              {document.subject.label}
              {document.subject.identifier
                ? ` · ${document.subject.identifier}`
                : ""}
            </>
          ) : (
            <span className="text-muted-foreground">
              Not linked to a subject
            </span>
          )}
        </Field>

        <Field label="Issuer">
          {document.issuer ?? (
            <span className="text-muted-foreground">Not recorded</span>
          )}
        </Field>

        <Field label="Document number">
          {document.document_number ?? (
            <span className="text-muted-foreground">Not recorded</span>
          )}
        </Field>

        <Field label="Filed">{formatDate(document.created_at.slice(0, 10))}</Field>
      </dl>

      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", className: "mt-6" })}
        >
          <ExternalLink className="size-4" />
          Open the file
        </a>
      ) : (
        <p className="mt-6 flex items-center gap-2 rounded-md bg-status-unknown-bg px-3 py-2 text-sm text-status-unknown">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          The stored file could not be reached. The details above are still
          correct.
        </p>
      )}
    </main>
  );
}
