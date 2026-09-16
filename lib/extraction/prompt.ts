import { DOCUMENT_TYPES } from "@/lib/validations/document.schema";

/**
 * The extraction prompt.
 *
 * Two things it deliberately does:
 *
 * 1. **Tells the model that null is an acceptable answer.** Without this,
 *    models guess — and a guessed expiry date is far worse than a missing one,
 *    because a missing one lands in the review queue while a guessed one sails
 *    through the gate and silently sets a wrong reminder schedule.
 *
 * 2. **Asks for calibrated confidence with explicit anchors.** "Give a
 *    confidence score" on its own produces 0.95 for everything. Describing what
 *    each band means gives the gate something that actually separates a clean
 *    scan from a blurry photo of a creased permit.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You read compliance documents and return structured data about them.

Return ONLY a JSON object. No prose, no markdown fences.

Fields:
- documentType: one of ${DOCUMENT_TYPES.map((t) => `"${t}"`).join(", ")}, or null if it is none of these or you cannot tell.
- documentNumber: the document's own reference, plate, policy or licence number as printed. null if absent.
- issuer: the authority or company that issued it, as printed. null if absent.
- issueDate: the date it was issued, "YYYY-MM-DD". null if absent or unreadable.
- expiryDate: the date it expires or is valid until, "YYYY-MM-DD". null if absent or unreadable.
- confidence: a number from 0 to 1.

Rules:
- Never guess. If a value is not legible or not present, return null for it. A null is correct and useful; an invented value is not.
- Transcribe dates exactly as printed, converting only the format. Do not infer a year, do not assume a renewal period.
- Where a document shows both "valid from" and "valid until", the second is expiryDate.
- Ambiguous numeric dates: prefer the reading consistent with the document's other dates. If still ambiguous, lower your confidence rather than picking one.

Confidence means how sure you are that expiryDate is correct, since that is the field this system acts on:
- 0.95-1.00: the expiry date is printed clearly and labelled unambiguously.
- 0.80-0.94: legible, but the label or format required some interpretation.
- 0.50-0.79: partly obscured, a poor scan, or a date whose meaning is uncertain.
- below 0.50: largely guesswork, or no expiry date found.`;

export const EXTRACTION_USER_PROMPT =
  "Extract the fields from this document and return the JSON object.";

/**
 * Provider-agnostic JSON schema for the response. Providers that support
 * structured output enforce this natively; the rest get it via the prompt and
 * are validated afterwards either way.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    documentType: {
      type: ["string", "null"],
      enum: [...DOCUMENT_TYPES, null],
    },
    documentNumber: { type: ["string", "null"] },
    issuer: { type: ["string", "null"] },
    issueDate: { type: ["string", "null"] },
    expiryDate: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
  required: [
    "documentType",
    "documentNumber",
    "issuer",
    "issueDate",
    "expiryDate",
    "confidence",
  ],
} as const;
