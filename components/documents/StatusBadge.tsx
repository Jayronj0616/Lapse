import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/supabase/types";
import { daysUntil, describeDayGap } from "@/lib/utils/dates";
import { STATUS_LABELS, toneFor, type StatusTone } from "@/lib/utils/status";

/**
 * The only place in the application that maps a status to a color.
 *
 * If a second file starts doing this, the two will drift and the dashboard
 * will contradict the document list about what counts as urgent. Import this
 * instead. CLAUDE.md calls it out for the same reason.
 *
 * Severity is never carried by color alone — the chip always states its status
 * in words, and adds the day count when there is one. That is what makes it
 * legible in grayscale and to a colorblind reader.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  ok: "bg-status-ok-bg text-status-ok",
  soon: "bg-status-soon-bg text-status-soon",
  warn: "bg-status-warn-bg text-status-warn",
  urgent: "bg-status-urgent-bg text-status-urgent",
  expired: "bg-status-expired-bg text-status-expired",
  review: "bg-status-review-bg text-status-review",
  unknown: "bg-status-unknown-bg text-status-unknown",
};

export function StatusBadge({
  status,
  expiry,
  className,
}: {
  status: DocumentStatus;
  expiry: string | null;
  className?: string;
}) {
  const tone = toneFor(status, expiry);

  // The day count is only meaningful while the document is on the expiry
  // timeline. A document awaiting review has no deadline to count down to.
  const showDayGap =
    expiry !== null &&
    (status === "active" || status === "expiring" || status === "expired");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden
      />
      {STATUS_LABELS[status]}
      {showDayGap ? (
        <span className="tabular-nums opacity-80">
          · {describeDayGap(daysUntil(expiry))}
        </span>
      ) : null}
    </span>
  );
}
