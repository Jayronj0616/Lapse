import { z } from "zod";

import { DOCUMENT_TYPES } from "./document.schema";

/**
 * The shape a provider must return.
 *
 * This is validated, not trusted. A model asked for JSON will still sometimes
 * produce prose, a wrong date format, or a confidence of 1.0 on a document it
 * misread entirely. Everything downstream — the gate, the review queue —
 * assumes it is dealing with a value that has already passed this.
 *
 * Every field is nullable on purpose. "I could not find the issuer" is a valid
 * and useful answer; inventing one is not.
 */
export const extractedFieldsSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES).nullable(),
  documentNumber: z.string().trim().max(120).nullable(),
  issuer: z.string().trim().max(120).nullable(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  /** The model's own estimate, 0–1. Treated as a hint, never as a guarantee. */
  confidence: z.number().min(0).max(1),
});

export type ExtractedFields = z.infer<typeof extractedFieldsSchema>;

/**
 * Parses a provider's raw text into validated fields.
 *
 * Models wrap JSON in markdown fences more often than they should, even when
 * told not to, so the fence is stripped before parsing rather than treated as
 * a failure.
 */
export function parseExtraction(
  text: string,
): { ok: true; fields: ExtractedFields } | { ok: false; error: string } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "The model did not return valid JSON." };
  }

  const parsed = extractedFieldsSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `The model's JSON did not match the expected shape: ${z.prettifyError(parsed.error)}`,
    };
  }

  return { ok: true, fields: parsed.data };
}
