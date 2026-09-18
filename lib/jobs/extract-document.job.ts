import { NonRetriableError } from "inngest";

import { gate } from "@/lib/extraction/gate";
import { getExtractionProvider } from "@/lib/extraction/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentStatus, Json } from "@/lib/supabase/types";
import { statusFromExpiry } from "@/lib/utils/status";
import type { ExtractedFields } from "@/lib/validations/extraction.schema";

import { eventData, inngest } from "./client";

const BUCKET = "documents";

/**
 * Reads an uploaded document and decides whether a human needs to look at it.
 *
 * Runs with the admin client, which **bypasses RLS entirely**. Every query
 * below therefore scopes `organization_id` by hand — this file is the one
 * place in the codebase where forgetting that filter would cross tenants.
 *
 * Each `step.run` is checkpointed by Inngest: a provider timeout retries the
 * model call without re-downloading the file, and a document is never left
 * stuck in `processing` because the process died halfway.
 */
export const extractDocument = inngest.createFunction(
  {
    id: "extract-document",
    // Inngest v4 takes the trigger inside the options object and the handler as
    // the second argument, rather than v3's three-argument form.
    triggers: [{ event: "lapse/document.uploaded" }],
    retries: 3,
    // One extraction per document at a time. Without this, a double-fired
    // event could run two attempts concurrently and race on the final status.
    concurrency: { key: "event.data.documentId", limit: 1 },
    onFailure: async ({ event }) => {
      // Every retry is spent. Park the document somewhere a person can see it
      // rather than leaving it in `processing` forever.
      const { documentId, organizationId } = eventData(
        "lapse/document.uploaded",
        event.data.event.data,
      );
      const supabase = createAdminClient();

      await supabase
        .from("documents")
        .update({ status: "extraction_failed" satisfies DocumentStatus })
        .eq("id", documentId)
        .eq("organization_id", organizationId)
        // Only if it is still waiting. A run can exhaust its retries *after* a
        // later run has already succeeded — a re-queued document, or the daily
        // sweep retrying a stalled one — and an unconditional update would then
        // overwrite a good extraction with a failure. The document would look
        // like it worked and then silently revert minutes later, which is the
        // kind of thing nobody ever manages to reproduce.
        //
        // Scoping the update to `processing` makes the late failure a no-op.
        .eq("status", "processing" satisfies DocumentStatus);
    },
  },
  async ({ event, step }) => {
    const { documentId, organizationId } = eventData(
      "lapse/document.uploaded",
      event.data,
    );
    const supabase = createAdminClient();

    const document = await step.run("load-document", async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, organization_id, type, storage_path, status")
        .eq("id", documentId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (error) throw new Error(`Could not load document: ${error.message}`);

      // Deleted between the event firing and this running. Retrying will not
      // bring it back, so stop rather than burning the retry budget.
      if (!data) {
        throw new NonRetriableError(`Document ${documentId} no longer exists.`);
      }

      return data;
    });

    const file = await step.run("download-file", async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(document.storage_path);

      if (error || !data) {
        throw new Error(
          `Could not download the file: ${error?.message ?? "unknown error"}`,
        );
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return {
        base64: buffer.toString("base64"),
        mimeType: data.type || "application/octet-stream",
      };
    });

    // The provider call and the record of it are one step, and the step is
    // what throws.
    //
    // Inngest memoises step results, so a throw *outside* a step replays the
    // function from the top and serves every completed step from cache. The
    // model is never called a second time: the whole retry budget is spent
    // re-throwing a cached failure in milliseconds, and a transient "model
    // overloaded" from the provider permanently fails the document. Failing
    // inside the step is what makes `retries` above mean anything at all.
    //
    // The attempt is recorded either way, before the throw, so a retried
    // document leaves one row per real attempt rather than a single row no
    // matter how many times it was tried. Keeping failures is what makes
    // "how often is this provider wrong, and on what" answerable.
    const outcome = await step.run("call-provider", async () => {
      const provider = getExtractionProvider();
      const result = await provider({
        base64: file.base64,
        mimeType: file.mimeType,
      });

      const { count } = await supabase
        .from("extractions")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId)
        .eq("organization_id", organizationId);

      const attempt = (count ?? 0) + 1;

      await supabase.from("extractions").insert({
        organization_id: organizationId,
        document_id: documentId,
        provider: result.provider,
        model: result.model,
        attempt,
        status: result.ok ? "succeeded" : "failed",
        confidence: result.ok ? result.fields.confidence : null,
        extracted: result.ok ? (result.fields as unknown as Json) : null,
        raw_response: (result.raw ?? null) as Json,
        error: result.ok ? null : result.error,
      });

      if (!result.ok) {
        // Inside the step, so Inngest retries the model call itself. When the
        // budget runs out, onFailure above marks the document
        // extraction_failed.
        throw new Error(
          `Extraction attempt ${attempt} failed: ${result.error}`,
        );
      }

      return result;
    });

    return step.run("apply-result", async () => {
      const fields: ExtractedFields = outcome.fields;
      const decision = gate(fields, document.type);

      const status: DocumentStatus = decision.accept
        ? (statusFromExpiry(fields.expiryDate) ?? "needs_review")
        : "needs_review";

      await supabase
        .from("documents")
        .update({
          status,
          // Written even when the gate refuses: the reviewer needs to see what
          // the model read in order to judge it. The status is what stops an
          // unreviewed value being acted upon, not the absence of the value.
          document_number: fields.documentNumber,
          issuer: fields.issuer,
          issue_date: fields.issueDate,
          expiry_date: fields.expiryDate,
        })
        .eq("id", documentId)
        .eq("organization_id", organizationId);

      return {
        documentId,
        status,
        confidence: fields.confidence,
        accepted: decision.accept,
        reason: decision.accept ? null : decision.reason,
      };
    });
  },
);
