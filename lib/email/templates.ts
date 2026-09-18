import type { ReminderTier } from "@/lib/supabase/types";
import { describeDayGap, formatDate } from "@/lib/utils/dates";
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document.schema";
import type { DocumentType } from "@/lib/supabase/types";

/**
 * Reminder and escalation emails, sent as HTML with a plain-text alternative.
 *
 * The text part is not a fallback nobody sees. Plain text renders everywhere,
 * survives clients that block HTML, reads correctly in a screen reader, and
 * keeps these out of a promotions tab — which for an operational notice about
 * a document going illegal is the whole point. Both parts carry the same
 * facts, so a client showing either one is showing the complete message.
 *
 * Email HTML is not web HTML. Tables for layout, styles inline on every
 * element, no flexbox, no grid, no stylesheet — a decade-old Outlook renderer
 * has to cope with this.
 *
 * Colors are literal hex, and this is the one place in the project where that
 * is correct. `app/globals.css` holds the real tokens in `oklch()`, which no
 * mail client understands, and a CSS variable cannot cross into an email at
 * all. The values below are those same tokens converted to sRGB, so the
 * severity colors here match the status chips in the app. If DESIGN.md's
 * palette changes, convert it again — do not eyeball a replacement.
 */

/** Light-mode `--status-*` pairs from globals.css, converted to sRGB hex. */
const TIER_STYLE: Record<
  ReminderTier,
  { fg: string; bg: string; urgency: string }
> = {
  // status-soon: blue. 31-60 days is information, not an alarm.
  t60: { fg: "#006bbb", bg: "#dbf1ff", urgency: "expires in about two months" },
  // status-warn: amber.
  t30: { fg: "#946900", bg: "#ffecc1", urgency: "expires in about a month" },
  // status-urgent: orange.
  t7: { fg: "#bd4600", bg: "#ffe3ce", urgency: "expires within a week" },
  t1: { fg: "#bd4600", bg: "#ffe3ce", urgency: "expires tomorrow" },
  // status-expired: red.
  overdue: { fg: "#d01d21", bg: "#ffe3dd", urgency: "has expired" },
};

const INK = "#18181b";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const PAGE = "#f4f4f5";

const FONT =
  "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

/** Values reach these templates from user input and from model output. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Row = { label: string; value: string } | null;

/**
 * The shared shell. One card, one accent color, one action.
 *
 * `preheader` is the grey line a client prints beside the subject in the inbox
 * list. Left unset it picks up whatever text comes first, which would be the
 * wordmark — true of every message and therefore useless.
 */
function shell(input: {
  accentFg: string;
  accentBg: string;
  pill: string;
  preheader: string;
  headline: string;
  rows: Row[];
  url: string;
  cta: string;
  footnote: string;
}): string {
  const rows = input.rows
    .filter((row): row is { label: string; value: string } => row !== null)
    .map(
      (row) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${LINE};font:400 13px/1.4 ${FONT};color:${MUTED};white-space:nowrap;vertical-align:top;">${escapeHtml(row.label)}</td>
                <td style="padding:10px 0 10px 20px;border-bottom:1px solid ${LINE};font:500 14px/1.4 ${FONT};color:${INK};vertical-align:top;">${escapeHtml(row.value)}</td>
              </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.pill)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;font-size:1px;color:${PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:0 0 16px 2px;font:600 13px/1 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Lapse</td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid ${LINE};border-top:3px solid ${input.accentFg};border-radius:10px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:28px 28px 0 28px;">
                  <span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${input.accentBg};color:${input.accentFg};font:600 12px/1 ${FONT};letter-spacing:0.02em;">${escapeHtml(input.pill)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 28px 0 28px;font:600 21px/1.35 ${FONT};color:${INK};">${escapeHtml(input.headline)}</td>
              </tr>
              <tr>
                <td style="padding:20px 28px 0 28px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px 28px 28px;">
                  <a href="${escapeHtml(input.url)}" style="display:inline-block;padding:11px 20px;border-radius:7px;background:${input.accentFg};color:#ffffff;font:600 14px/1 ${FONT};text-decoration:none;">${escapeHtml(input.cta)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 2px 0 2px;font:400 12px/1.6 ${FONT};color:${MUTED};">${escapeHtml(input.footnote)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

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
  const style = TIER_STYLE[input.tier];
  const what = input.subjectLabel
    ? `${input.documentTitle} (${input.subjectLabel})`
    : input.documentTitle;

  const subject =
    input.tier === "overdue"
      ? `Expired: ${what}`
      : `Expiring ${describeDayGap(input.daysUntil)}: ${what}`;

  const text = [
    `${what} ${style.urgency}.`,
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

  const html = shell({
    accentFg: style.fg,
    accentBg: style.bg,
    pill:
      input.tier === "overdue"
        ? "Expired"
        : `Expires ${describeDayGap(input.daysUntil)}`,
    preheader: `${what} ${style.urgency}.`,
    headline: `${input.documentTitle} ${style.urgency}.`,
    rows: [
      { label: "Type", value: DOCUMENT_TYPE_LABELS[input.documentType] },
      input.subjectLabel ? { label: "Covers", value: input.subjectLabel } : null,
      {
        label: "Expiry date",
        value: `${formatDate(input.expiryDate)} (${describeDayGap(input.daysUntil)})`,
      },
      { label: "Organization", value: input.organizationName },
    ],
    url: input.url,
    cta: "Open the document",
    footnote:
      "Acknowledging it in the app stops the reminders and records that you saw it.",
  });

  return { subject, text, html };
}

export function escalationEmail(input: {
  organizationName: string;
  documentTitle: string;
  responsibleName: string;
  expiryDate: string;
  daysUntil: number;
  url: string;
}) {
  // Always the expired palette. An escalation only fires once a reminder has
  // gone unanswered for three days, so it is never the mild end of the scale.
  const style = TIER_STYLE.overdue;

  const text = [
    `A reminder for ${input.documentTitle} has gone unacknowledged.`,
    "",
    `Responsible:  ${input.responsibleName}`,
    `Expiry date:  ${formatDate(input.expiryDate)} (${describeDayGap(input.daysUntil)})`,
    `Organization: ${input.organizationName}`,
    "",
    `Open it here: ${input.url}`,
    "",
    "You are receiving this because you own this organization and nobody has responded to the earlier notices.",
  ].join("\n");

  const html = shell({
    accentFg: style.fg,
    accentBg: style.bg,
    pill: "Unacknowledged",
    preheader: `Nobody has responded to the reminders for ${input.documentTitle}.`,
    headline: `A reminder for ${input.documentTitle} has gone unacknowledged.`,
    rows: [
      { label: "Responsible", value: input.responsibleName },
      {
        label: "Expiry date",
        value: `${formatDate(input.expiryDate)} (${describeDayGap(input.daysUntil)})`,
      },
      { label: "Organization", value: input.organizationName },
    ],
    url: input.url,
    cta: "Open the document",
    footnote:
      "You are receiving this because you own this organization and nobody has responded to the earlier notices.",
  });

  return { subject: `Unacknowledged: ${input.documentTitle}`, text, html };
}
