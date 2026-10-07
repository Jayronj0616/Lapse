import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentType } from "@/lib/supabase/types";
import type { ExtractedFields } from "@/lib/validations/extraction.schema";
import { confidenceThreshold, gate } from "./gate";

const NOW = new Date("2026-10-07T12:00:00Z");

function fields(overrides: Partial<ExtractedFields> = {}): ExtractedFields {
  return {
    documentType: null,
    documentNumber: "ABC-123",
    issuer: "LTO",
    issueDate: "2025-10-07",
    expiryDate: "2027-10-07",
    confidence: 0.95,
    ...overrides,
  };
}

const DECLARED: DocumentType = "vehicle_registration";

const decide = (overrides: Partial<ExtractedFields> = {}) =>
  gate(fields(overrides), DECLARED, NOW);

afterEach(() => vi.unstubAllEnvs());

describe("confidenceThreshold", () => {
  it("defaults to 0.90", () => {
    vi.stubEnv("EXTRACTION_CONFIDENCE_THRESHOLD", "");
    expect(confidenceThreshold()).toBe(0.9);
  });

  it("honours a valid override", () => {
    vi.stubEnv("EXTRACTION_CONFIDENCE_THRESHOLD", "0.75");
    expect(confidenceThreshold()).toBe(0.75);
  });

  it.each(["abc", "1.5", "-0.1"])("ignores the invalid value %s", (raw) => {
    vi.stubEnv("EXTRACTION_CONFIDENCE_THRESHOLD", raw);
    expect(confidenceThreshold()).toBe(0.9);
  });
});

describe("gate", () => {
  it("accepts a confident, plausible extraction", () => {
    vi.stubEnv("EXTRACTION_CONFIDENCE_THRESHOLD", "");
    expect(decide()).toEqual({ accept: true });
  });

  it("rejects when no expiry date was found", () => {
    const result = decide({ expiryDate: null });
    expect(result.accept).toBe(false);
  });

  it("rejects exactly on the old 0.85 round number", () => {
    vi.stubEnv("EXTRACTION_CONFIDENCE_THRESHOLD", "");
    expect(decide({ confidence: 0.85 }).accept).toBe(false);
  });

  it("accepts at the threshold itself", () => {
    vi.stubEnv("EXTRACTION_CONFIDENCE_THRESHOLD", "");
    expect(decide({ confidence: 0.9 }).accept).toBe(true);
  });

  it("rejects an expiry before the issue date", () => {
    const result = decide({ issueDate: "2026-06-01", expiryDate: "2025-06-01" });
    expect(result).toMatchObject({ accept: false });
  });

  it("rejects an expiry implausibly far ahead", () => {
    expect(decide({ expiryDate: "2060-01-01" }).accept).toBe(false);
  });

  it("rejects an expiry implausibly far back", () => {
    expect(decide({ issueDate: null, expiryDate: "1980-01-01" }).accept).toBe(false);
  });

  it("accepts a long but plausible validity", () => {
    expect(decide({ expiryDate: "2040-01-01" }).accept).toBe(true);
  });

  it("rejects when the model reads a different document type than declared", () => {
    const result = decide({ documentType: "insurance_policy" });
    expect(result).toMatchObject({ accept: false });
  });

  it("accepts when the model agrees with the declared type", () => {
    expect(decide({ documentType: "vehicle_registration" }).accept).toBe(true);
  });
});
