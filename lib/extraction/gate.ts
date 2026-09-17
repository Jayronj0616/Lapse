import type { DocumentType } from "@/lib/supabase/types";
import type { ExtractedFields } from "@/lib/validations/extraction.schema";

/**
 * The confidence gate — the part of this system that actually matters.
 *
 * A better prompt reduces errors. It does not eliminate them, and no threshold
 * will. So the design assumption is that the model *will* be wrong sometimes,
 * and the question is only whether a wrong answer is caught by a person or
 * quietly becomes a reminder schedule built on a date nobody checked.
 *
 * Everything here fails toward the review queue. A document sent for review
 * that did not need it costs someone ten seconds; a bad expiry date waved
 * through costs a fine.
 */

export type GateDecision =
  | { accept: true }
  | { accept: false; reason: string };

/**
 * 0.90, not 0.85, and the difference is not arbitrary.
 *
 * Models do not emit a smooth distribution of confidences — they cluster hard
 * on round numbers, overwhelmingly 0.85, 0.90 and 0.95. Putting the threshold
 * exactly on one of those values means every document that lands on it is
 * decided by which way the comparison happens to be written rather than by any
 * judgement about the document.
 *
 * This was found the first time a deliberately ambiguous document was run
 * through: the model correctly signalled hesitation by dropping to exactly
 * 0.85, and a `< 0.85` gate accepted it anyway. At 0.90 only 0.90 and above
 * pass, so a model expressing any doubt at all reaches a human — which is the
 * stance this whole system takes.
 */
const DEFAULT_THRESHOLD = 0.9;

/** Beyond this, a parsed year is a misread rather than a long-dated document. */
const MAX_YEARS_AHEAD = 20;
/** Documents this old are not things anyone is tracking the expiry of. */
const MAX_YEARS_BEHIND = 30;

export function confidenceThreshold(): number {
  const raw = process.env.EXTRACTION_CONFIDENCE_THRESHOLD;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : DEFAULT_THRESHOLD;
}

export function gate(
  fields: ExtractedFields,
  declaredType: DocumentType,
  from: Date = new Date(),
): GateDecision {
  // No expiry date is not a low-confidence answer, it is a missing one. There
  // is nothing for the system to act on, so a person has to supply it.
  if (!fields.expiryDate) {
    return {
      accept: false,
      reason: "No expiry date was found in the document.",
    };
  }

  const threshold = confidenceThreshold();
  if (fields.confidence < threshold) {
    return {
      accept: false,
      reason: `The model reported ${Math.round(fields.confidence * 100)}% confidence, below the ${Math.round(threshold * 100)}% needed to accept automatically.`,
    };
  }

  // ISO date strings compare correctly as plain strings, so none of these
  // checks can drift across a timezone boundary.
  if (fields.issueDate && fields.expiryDate < fields.issueDate) {
    return {
      accept: false,
      reason: "The extracted expiry date falls before the issue date.",
    };
  }

  const year = Number(fields.expiryDate.slice(0, 4));
  const thisYear = from.getUTCFullYear();

  if (year > thisYear + MAX_YEARS_AHEAD) {
    return {
      accept: false,
      reason: `An expiry in ${year} is implausibly far ahead and is more likely a misread year.`,
    };
  }

  if (year < thisYear - MAX_YEARS_BEHIND) {
    return {
      accept: false,
      reason: `An expiry in ${year} is implausibly far back and is more likely a misread year.`,
    };
  }

  // The uploader said what this document is. A model that read something else
  // may have been handed the wrong file, or may have misread it — either way
  // that is a disagreement a person should settle, not one to resolve silently
  // in favour of either party.
  if (fields.documentType && fields.documentType !== declaredType) {
    return {
      accept: false,
      reason: `This was filed as a ${declaredType.replace(/_/g, " ")}, but the document reads as a ${fields.documentType.replace(/_/g, " ")}.`,
    };
  }

  return { accept: true };
}
