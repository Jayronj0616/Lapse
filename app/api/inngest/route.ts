import { serve } from "inngest/next";

import { inngest } from "@/lib/jobs/client";
import { extractDocument } from "@/lib/jobs/extract-document.job";

/**
 * Inngest's entry point. It calls back into this route to run each step, which
 * is why the work lives here rather than in a Server Action: the runner needs
 * an address it can reach.
 *
 * Signature verification is handled by `serve` using INNGEST_SIGNING_KEY, so
 * this endpoint is safe to expose publicly — which it has to be.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [extractDocument],
});
