import Link from "next/link";

import { StatusBadge } from "@/components/documents/StatusBadge";
import type { DocumentWithSubject } from "@/lib/services/document.service";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document.schema";

/**
 * One band of the triage screen. Rendered only when it has something in it —
 * an empty "Expired" heading is noise that pushes the real problems down.
 */
export function ExceptionGroup({
  title,
  description,
  documents,
  orgSlug,
  href,
}: {
  title: string;
  description: string;
  documents: DocumentWithSubject[];
  orgSlug: string;
  /**
   * Where a row goes. Defaults to the document itself; the review group points
   * at the queue instead, because the useful next action there is reviewing,
   * not reading.
   */
  href?: string;
}) {
  if (documents.length === 0) return null;

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">
          {title}
          <span className="ml-2 tabular-nums text-muted-foreground">
            {documents.length}
          </span>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </header>

      <ul className="divide-y">
        {documents.map((document) => (
          <li key={document.id}>
            <Link
              href={href ?? `/${orgSlug}/documents/${document.id}`}
              className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{document.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {DOCUMENT_TYPE_LABELS[document.type]}
                  {document.subject ? ` · ${document.subject.label}` : ""}
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
    </section>
  );
}
