import "server-only";

import { requireUser } from "@/lib/services/auth.service";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentStatus,
  Extraction,
  Json,
  ReviewAction,
} from "@/lib/supabase/types";
import { statusFromExpiry } from "@/lib/utils/status";
import type {
  RejectReviewInput,
  SubmitReviewInput,
} from "@/lib/validations/review.schema";

import type { DocumentWithSubject } from "./document.service";

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

/** A queued document together with the attempt that produced its values. */
export type ReviewItem = DocumentWithSubject & {
  extraction: Pick<
    Extraction,
    "confidence" | "provider" | "model" | "attempt" | "error" | "created_at"
  > | null;
};

/**
 * Everything waiting on a human.
 *
 * Ordered oldest first, not by confidence. A queue sorted by confidence quietly
 * becomes a queue where the least certain documents are never reached.
 */
export async function listPending(
  organizationId: string,
): Promise<ReviewItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(
      "*, subject:subjects(id, label, kind, identifier), extractions(confidence, provider, model, attempt, error, created_at)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "needs_review")
    .order("created_at", { ascending: true });

  if (error) {
    throw new ReviewError(`Could not load the review queue: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const { extractions, ...document } = row as unknown as DocumentWithSubject & {
      extractions: ReviewItem["extraction"][];
    };

    // Most recent attempt — that is the one whose values are on the document.
    const latest = [...(extractions ?? [])].sort((a, b) =>
      (b?.attempt ?? 0) - (a?.attempt ?? 0),
    )[0];

    return { ...document, extraction: latest ?? null };
  });
}

export async function countPending(organizationId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "needs_review");

  if (error) {
    throw new ReviewError(`Could not count the review queue: ${error.message}`);
  }

  return count ?? 0;
}

/** The fields a review can change, as stored on the review row. */
function snapshot(document: {
  type: string;
  document_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
}): Json {
  return {
    type: document.type,
    documentNumber: document.document_number,
    issuer: document.issuer,
    issueDate: document.issue_date,
    expiryDate: document.expiry_date,
  } as Json;
}

/**
 * Accepts a reviewed document, correcting its fields if the reviewer changed
 * any.
 *
 * `approved` and `corrected` are derived by comparing to what is already
 * stored rather than from which button was pressed. A reviewer who edits a
 * field and a reviewer who does not are making genuinely different statements
 * about the model's output, and that difference is the whole reason to keep
 * this table — asking the reviewer to also classify their own action would
 * just add a way for the record to be wrong.
 */
export async function submit(
  organizationId: string,
  input: SubmitReviewInput,
): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: current, error: loadError } = await supabase
    .from("documents")
    .select("id, type, document_number, issuer, issue_date, expiry_date")
    .eq("id", input.documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (loadError || !current) {
    throw new ReviewError("That document is no longer available to review.");
  }

  const before = snapshot(current);
  const after = {
    type: input.type,
    documentNumber: input.documentNumber,
    issuer: input.issuer,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
  } as Json;

  const action: ReviewAction =
    JSON.stringify(before) === JSON.stringify(after) ? "approved" : "corrected";

  const status: DocumentStatus = statusFromExpiry(input.expiryDate) ?? "active";

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      type: input.type,
      document_number: input.documentNumber,
      issuer: input.issuer,
      issue_date: input.issueDate,
      expiry_date: input.expiryDate,
      status,
    })
    .eq("id", input.documentId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new ReviewError(
      updateError.code === "42501"
        ? "Only owners, managers, or the person responsible for this document can review it."
        : `Could not apply the review: ${updateError.message}`,
    );
  }

  const { error: reviewError } = await supabase
    .from("document_reviews")
    .insert({
      organization_id: organizationId,
      document_id: input.documentId,
      reviewer_id: user.id,
      action,
      before,
      after,
      note: input.note,
    });

  // The document is already corrected at this point. Failing loudly here would
  // suggest the correction did not happen, which would be worse than a missing
  // review row — and the audit trigger has recorded the document change either
  // way, so nothing is actually unaccounted for.
  if (reviewError) {
    console.error(
      `[reviews] document ${input.documentId} was updated but its review row failed:`,
      reviewError.message,
    );
  }
}

/**
 * Rejects a document outright — the wrong file, an unreadable scan, a
 * duplicate. It is archived rather than deleted, because the fact that someone
 * filed it and someone else threw it out is itself worth keeping.
 */
export async function reject(
  organizationId: string,
  input: RejectReviewInput,
): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: current, error: loadError } = await supabase
    .from("documents")
    .select("id, type, document_number, issuer, issue_date, expiry_date")
    .eq("id", input.documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (loadError || !current) {
    throw new ReviewError("That document is no longer available to review.");
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({ status: "archived" satisfies DocumentStatus })
    .eq("id", input.documentId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new ReviewError(
      updateError.code === "42501"
        ? "Only owners, managers, or the person responsible for this document can reject it."
        : `Could not reject the document: ${updateError.message}`,
    );
  }

  await supabase.from("document_reviews").insert({
    organization_id: organizationId,
    document_id: input.documentId,
    reviewer_id: user.id,
    action: "rejected",
    before: snapshot(current),
    after: null,
    note: input.note,
  });
}
