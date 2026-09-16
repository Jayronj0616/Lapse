import "server-only";

import { parseExtraction } from "@/lib/validations/extraction.schema";

import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
} from "./prompt";
import type { ExtractionInput, ExtractionOutcome } from "./provider";

/**
 * Azure AI Foundry, over the OpenAI-compatible chat completions API.
 *
 * Intended for local development and bulk testing, where employer-provided
 * credits are genuinely useful. The deployed demo runs on Gemini instead, so
 * that a public URL does not depend on an account that will eventually go away.
 *
 * **Known limitation:** the vision chat API takes images, not PDFs. A PDF sent
 * here is rejected up front rather than half-processed, because a silent
 * failure on one file type is far more confusing than an explicit one. If PDF
 * support becomes necessary on this provider, rasterise the first page before
 * calling it — do not paper over it here.
 */

const API_VERSION = "2024-10-21";

export async function extractWithFoundry(
  input: ExtractionInput,
): Promise<ExtractionOutcome> {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT;
  const model = deployment ?? "unknown";

  if (!endpoint || !apiKey || !deployment) {
    return {
      ok: false,
      provider: "foundry",
      model,
      error:
        "AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY and AZURE_FOUNDRY_DEPLOYMENT must all be set.",
      raw: null,
    };
  }

  if (input.mimeType === "application/pdf") {
    return {
      ok: false,
      provider: "foundry",
      model,
      error:
        "This provider cannot read PDFs. Use the gemini provider for PDF documents.",
      raw: null,
    };
  }

  let raw: unknown = null;

  try {
    const response = await fetch(
      `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${API_VERSION}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: EXTRACTION_USER_PROMPT },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.base64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      },
    );

    raw = await response.json();

    if (!response.ok) {
      const message =
        (raw as { error?: { message?: string } })?.error?.message ??
        `HTTP ${response.status}`;
      return { ok: false, provider: "foundry", model, error: message, raw };
    }

    const text = (raw as { choices?: { message?: { content?: string } }[] })
      ?.choices?.[0]?.message?.content;

    if (!text) {
      return {
        ok: false,
        provider: "foundry",
        model,
        error: "The response contained no text.",
        raw,
      };
    }

    const parsed = parseExtraction(text);
    if (!parsed.ok) {
      return { ok: false, provider: "foundry", model, error: parsed.error, raw };
    }

    return { ok: true, provider: "foundry", model, fields: parsed.fields, raw };
  } catch (error) {
    return {
      ok: false,
      provider: "foundry",
      model,
      error: error instanceof Error ? error.message : "Request failed.",
      raw,
    };
  }
}
