/**
 * Analytics events. Names only, never identifiers: no user, organization or
 * document details are ever attached.
 *
 * Auth and upload actions end in `redirect()`, so the browser never sees a
 * success state to react to. The action leaves a short-lived cookie naming the
 * event instead, and `AnalyticsScript` reports it once on the next page.
 */
export const PENDING_EVENT_COOKIE = "lapse_event";

export const PENDING_EVENTS = [
  "signed_up",
  "logged_in",
  "document_uploaded",
] as const;

export type PendingEvent = (typeof PENDING_EVENTS)[number];
