import { Inngest } from "inngest";

/**
 * The job runner.
 *
 * Extraction is slow, fails in ways worth retrying, and is triggered by an
 * upload rather than by someone waiting on a response — which is the textbook
 * case for a durable job rather than a Server Action. Doing it inline would
 * mean an upload request held open while a model reads a scan, and a provider
 * timeout losing the work entirely.
 */
/** Events this application emits. Keep the names and payloads in one place. */
export type Events = {
  "lapse/document.uploaded": {
    data: {
      documentId: string;
      organizationId: string;
    };
  };
};

export const inngest = new Inngest({ id: "lapse" });

/**
 * Narrows a raw event payload to a known event's data.
 *
 * Inngest v4 removed `EventSchemas`, and its replacement is not something to
 * adopt from guesswork. Until that is settled, jobs call this at their entry
 * point so the payload contract still lives in this file rather than being
 * re-asserted ad hoc in each handler. It is the same single point of truth,
 * just enforced one layer later.
 */
export function eventData<K extends keyof Events>(
  _name: K,
  data: unknown,
): Events[K]["data"] {
  return data as Events[K]["data"];
}
