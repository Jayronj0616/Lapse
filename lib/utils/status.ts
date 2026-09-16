import type { DocumentStatus } from "@/lib/supabase/types";

import { daysUntil } from "./dates";

/**
 * The visual severity a document carries. Distinct from `DocumentStatus`,
 * which is what the database records — several statuses share a tone, and
 * `expiring` splits into three tones depending on how close it is.
 *
 * `review` sits deliberately off the ok→expired scale: "the model was not
 * sure" is a different kind of problem, not a degree of urgency. See DESIGN.md.
 */
export type StatusTone =
  | "ok"
  | "soon"
  | "warn"
  | "urgent"
  | "expired"
  | "review"
  | "unknown";

/** Thresholds in days. Shared with the reminder ladder so the two agree. */
export const EXPIRY_THRESHOLDS = {
  soon: 60,
  warn: 30,
  urgent: 7,
} as const;

/**
 * What the daily sweep will set `documents.status` to, given an expiry date.
 *
 * Only ever applied to documents that already hold an expiry date — a document
 * still processing, awaiting review, or archived keeps the status it has.
 */
export function statusFromExpiry(
  expiry: string | null,
  from: Date = new Date(),
): Extract<DocumentStatus, "active" | "expiring" | "expired"> | null {
  if (!expiry) return null;

  const days = daysUntil(expiry, from);
  if (days < 0) return "expired";
  if (days <= EXPIRY_THRESHOLDS.soon) return "expiring";
  return "active";
}

/**
 * The tone a document should be rendered in.
 *
 * Every status-to-color decision in the app resolves through this one
 * function, so the dashboard and the document list cannot disagree about what
 * counts as urgent.
 */
export function toneFor(
  status: DocumentStatus,
  expiry: string | null,
  from: Date = new Date(),
): StatusTone {
  switch (status) {
    case "needs_review":
      return "review";
    case "processing":
    case "extraction_failed":
    case "archived":
      return "unknown";
    case "expired":
      return "expired";
    case "active":
    case "expiring":
      break;
  }

  if (!expiry) return "unknown";

  const days = daysUntil(expiry, from);
  if (days < 0) return "expired";
  if (days <= EXPIRY_THRESHOLDS.urgent) return "urgent";
  if (days <= EXPIRY_THRESHOLDS.warn) return "warn";
  if (days <= EXPIRY_THRESHOLDS.soon) return "soon";
  return "ok";
}

/** Human label for a status, used in chips and filters. */
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  processing: "Processing",
  needs_review: "Needs review",
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  extraction_failed: "Extraction failed",
  archived: "Archived",
};
