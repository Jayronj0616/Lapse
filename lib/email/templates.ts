import type { ReminderTier } from "@/lib/supabase/types";
import { describeDayGap, formatDate } from "@/lib/utils/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document.schema";
import type { DocumentType } from "@/lib/supabase/types";

/**
 * Plain text, not HTML.
 *
 * These are operational notices, not marketing. Plain text renders everywhere,
 * never lands in a promotions tab, and cannot break in a mail client — and
 * there is nothing here that a layout would make clearer.
 */

const TIER_URGENCY: Record<ReminderTier, string> = {
  t60: "expires in about two months",
  t30: "expires in about a month",
  t7: "expires within a week",
  t1: "expires tomorrow",
  overdue: "has expired",
};

export function reminderEmail(input: {
  tier: ReminderTier;
  organizationName: string;
  documentTitle: string;
  documentType: DocumentType;
  subjectLabel: string | null;
  expiryDate: string;
  daysUntil: number;
  url: string;
}) {
  const what = input.subjectLabel
    ? `${input.documentTitle} (${input.subjectLabel})`
    : input.documentTitle;

  const subject =
    input.tier === "overdue"
      ? `Expired: ${what}`
      : `Expiring ${describeDayGap(input.daysUntil)}: ${what}`;

  const text = [
    `${what} ${TIER_URGENCY[input.tier]}.`,
    "",
    `Document:     ${input.documentTitle}`,
    `Type:         ${DOCUMENT_TYPE_LABELS[input.documentType]}`,
    input.subjectLabel ? `Covers:       ${input.subjectLabel}` : null,
    `Expiry date:  ${formatDate(input.expiryDate)} (${describeDayGap(input.daysUntil)})`,
    `Organization: ${input.organizationName}`,
    "",
    `Open it here: ${input.url}`,
    "",
    "Acknowledging it in the app stops the reminders and records that you saw it.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, text };
}

export function escalationEmail(input: {
  organizationName: string;
  documentTitle: string;
  responsibleName: string;
  expiryDate: string;
  daysUntil: number;
  url: string;
}) {
  return {
    subject: `Unacknowledged: ${input.documentTitle}`,
    text: [
      `A reminder for ${input.documentTitle} has gone unacknowledged.`,
      "",
      `Responsible:  ${input.responsibleName}`,
      `Expiry date:  ${formatDate(input.expiryDate)} (${describeDayGap(input.daysUntil)})`,
      `Organization: ${input.organizationName}`,
      "",
      `Open it here: ${input.url}`,
      "",
      "You are receiving this because you own this organization and nobody has responded to the earlier notices.",
    ].join("\n"),
  };
}
