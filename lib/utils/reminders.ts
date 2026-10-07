import type { ReminderTier } from "@/lib/supabase/types";

/**
 * Which reminder is due for a document right now, or null if none is.
 *
 * Only the *most urgent* tier that applies is returned. A document uploaded
 * three days before it expires should get one "expiring within a week" notice,
 * not the whole ladder at once — and the unique constraint on
 * (document_id, tier, channel) makes each tier fire exactly once.
 *
 * That constraint also means `overdue` fires once rather than daily, which is
 * a deliberate departure from the original plan: an expired document already
 * sits permanently in the dashboard's "Expired" group, and a daily email about
 * it teaches people to filter the sender.
 */
export function tierFor(days: number): ReminderTier | null {
  if (days < 0) return "overdue";
  if (days <= 1) return "t1";
  if (days <= 7) return "t7";
  if (days <= 30) return "t30";
  if (days <= 60) return "t60";
  return null;
}
