/**
 * Date helpers for expiry math.
 *
 * `issue_date` and `expiry_date` are Postgres `date` columns and arrive as
 * "YYYY-MM-DD" strings with no time and no zone. Passing those through the
 * usual Date arithmetic is where expiry bugs come from: a document expiring on
 * the 30th can read as the 29th or the 31st depending on the server's offset,
 * which is the difference between "renew today" and "you are already illegal".
 *
 * Everything here works in UTC calendar days on purpose. There is no time of
 * day involved in a permit expiring, so introducing one can only cause drift.
 */

/** Parses "YYYY-MM-DD" as a UTC calendar date. */
function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Today as a UTC calendar date, with the time of day discarded. */
function utcToday(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days from today until `expiry`. Negative once it has passed, zero on
 * the day itself.
 */
export function daysUntil(expiry: string, from: Date = new Date()): number {
  return Math.round(
    (parseISODate(expiry).getTime() - utcToday(from).getTime()) / MS_PER_DAY,
  );
}

/** Today as "YYYY-MM-DD", for date inputs and defaults. */
export function todayISO(from: Date = new Date()): string {
  return utcToday(from).toISOString().slice(0, 10);
}

/** "in 12 days", "today", "8 days ago" — the phrasing the UI uses everywhere. */
export function describeDayGap(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** "12 Mar 2027" — stable regardless of the viewer's locale. */
export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
