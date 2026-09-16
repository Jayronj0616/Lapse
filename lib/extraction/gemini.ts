import "server-only";

import { parseExtraction } from "@/lib/validations/extraction.schema";

import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
} from "./prompt";
import type { ExtractionInput, ExtractionOutcome } from "./provider";

/**
 * Google Gemini, over the REST API.
 *
 * Called directly with fetch rather than through an SDK. The interface here is
 * small and stable, the job runner already owns retries and backoff, and one
 * fewer dependency is one fewer breaking change to absorb on a provider we
 * expect to swap.
 *
 * Gemini accepts PDFs as inline data alongside images, which matters — a good
 * share of compliance documents arrive as scanned PDFs rather than photos.
 */

const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function extractWithGemini(
  input: ExtractionInput,
): Promise<ExtractionOutcome> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      provider: "gemini",
      model,
      error: "GEMINI_API_KEY is not set.",
      raw: null,
    };
  }

  let raw: unknown = null;

  try {
    const response = await fetch(
      `${ENDPOINT}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: EXTRACTION_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: EXTRACTION_USER_PROMPT },
                {
                  inline_data: {
                    mime_type: input.mimeType,
                    data: input.base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            // Structured output: the model is constrained to JSON rather than
            // merely asked for it. The result is still validated afterwards.
            responseMimeType: "application/json",
            // Extraction is transcription, not composition. Sampling variety
            // here would mean the same document reading differently on a retry.
            temperature: 0,
          },
        }),
      },
    );

    raw = await response.json();

    if (!response.ok) {
      const message =
        (raw as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return { ok: false, provider: "gemini", model, error: message, raw };
    }

    const text = (
      raw as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      }
    )?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        ok: false,
        provider: "gemini",
        model,
        error: "The response contained no text.",
        raw,
      };
    }

    const parsed = parseExtraction(text);
    if (!parsed.ok) {
      return { ok: false, provider: "gemini", model, error: parsed.error, raw };
    }

    return { ok: true, provider: "gemini", model, fields: parsed.fields, raw };
  } catch (error) {
    return {
      ok: false,
      provider: "gemini",
      model,
      error: error instanceof Error ? error.message : "Request failed.",
      raw,
    };
  }
}
