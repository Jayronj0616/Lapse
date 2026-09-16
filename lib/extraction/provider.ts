import "server-only";

import type { ExtractedFields } from "@/lib/validations/extraction.schema";

import { extractWithFoundry } from "./foundry";
import { extractWithGemini } from "./gemini";

/**
 * The seam between this application and whichever model happens to be reading
 * documents today.
 *
 * Services and jobs import from here and nowhere else, so swapping providers is
 * an environment variable rather than a refactor. That matters more than usual
 * on this project: the deployed demo runs on a free tier that could change its
 * limits, and the alternative is employer-provided credits that will not last
 * forever. Neither is a thing to couple a codebase to.
 */

export type ExtractionInput = {
  /** The document file itself, base64 without a data: prefix. */
  base64: string;
  mimeType: string;
};

export type ExtractionOutcome =
  | {
      ok: true;
      provider: string;
      model: string;
      fields: ExtractedFields;
      raw: unknown;
    }
  | {
      ok: false;
      provider: string;
      model: string;
      error: string;
      raw: unknown;
    };

export type ExtractionProvider = (
  input: ExtractionInput,
) => Promise<ExtractionOutcome>;

const PROVIDERS: Record<string, ExtractionProvider> = {
  gemini: extractWithGemini,
  foundry: extractWithFoundry,
};

/**
 * Picks the provider named by EXTRACTION_PROVIDER.
 *
 * Throws on an unknown name rather than silently defaulting. A typo that
 * quietly falls back to a different model is the kind of bug that only shows
 * up as a mysterious change in extraction quality weeks later.
 */
export function getExtractionProvider(): ExtractionProvider {
  const name = process.env.EXTRACTION_PROVIDER ?? "gemini";
  const provider = PROVIDERS[name];

  if (!provider) {
    throw new Error(
      `Unknown EXTRACTION_PROVIDER "${name}". Expected one of: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }

  return provider;
}

export function currentProviderName(): string {
  return process.env.EXTRACTION_PROVIDER ?? "gemini";
}
