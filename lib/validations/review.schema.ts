import { z } from "zod";

import { DOCUMENT_TYPES } from "./document.schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

/**
 * What a reviewer submits.
 *
 * The reviewer is correcting what the model read, so every field is editable —
 * including the document type, since a disagreement about what the document
 * even is, is one of the reasons it reaches the queue in the first place.
 */
export const submitReviewSchema = z
  .object({
    documentId: z.uuid(),
    type: z.enum(DOCUMENT_TYPES),
    documentNumber: z.string().trim().max(120).nullable(),
    issuer: z.string().trim().max(120).nullable(),
    issueDate: isoDate.nullable(),
    // Required here, unlike on upload. A reviewer's whole job is to settle
    // this value — approving a document while leaving it unknown would put it
    // back in the queue it just came out of.
    expiryDate: isoDate,
    note: z.string().trim().max(500).nullable(),
  })
  .refine(
    (data) => !data.issueDate || data.expiryDate >= data.issueDate,
    {
      error: "The expiry date cannot be before the issue date.",
      path: ["expiryDate"],
    },
  );

export const rejectReviewSchema = z.object({
  documentId: z.uuid(),
  note: z
    .string()
    .trim()
    .min(1, "Say why this document is being rejected.")
    .max(500),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type RejectReviewInput = z.infer<typeof rejectReviewSchema>;
