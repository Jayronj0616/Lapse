import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";

import * as auditService from "@/lib/services/audit.service";
import * as organizationService from "@/lib/services/organization.service";

export const metadata: Metadata = {
  title: "Audit log",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "created",
  update: "changed",
  delete: "deleted",
};

const ENTITY_LABELS: Record<string, string> = {
  documents: "document",
  subjects: "subject",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditPage({
  params,
}: PageProps<"/[orgSlug]/audit">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  // Staff get an empty list rather than an error — the RLS policy restricts
  // reads to owners and managers, so there is nothing extra to check here.
  const entries = await auditService.listForOrganization(organization.id);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Written by database triggers, not by the application. Nothing can change
        a document or a subject without leaving a row here.
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <ScrollText className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-medium">Nothing logged yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Activity appears here as soon as documents and subjects start
            changing.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <p className="text-sm">
                <span className="font-medium">
                  {entry.actor?.full_name ?? entry.actor?.email ?? "System"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {ACTION_LABELS[entry.action] ?? entry.action} a{" "}
                  {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                </span>
              </p>
              <time
                dateTime={entry.created_at}
                className="shrink-0 text-sm tabular-nums text-muted-foreground"
              >
                {formatWhen(entry.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
