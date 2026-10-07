import { describe, expect, it } from "vitest";
import { EXPIRY_THRESHOLDS, statusFromExpiry, toneFor } from "./status";

const NOW = new Date("2026-10-07T12:00:00Z");

/** An ISO date `days` days after NOW. */
function inDays(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("statusFromExpiry", () => {
  it("returns null when there is no expiry date", () => {
    expect(statusFromExpiry(null, NOW)).toBeNull();
  });

  it("is expired only after the expiry date", () => {
    expect(statusFromExpiry(inDays(-1), NOW)).toBe("expired");
    expect(statusFromExpiry(inDays(0), NOW)).toBe("expiring");
  });

  it("is expiring up to and including the 60 day threshold", () => {
    expect(statusFromExpiry(inDays(EXPIRY_THRESHOLDS.soon), NOW)).toBe("expiring");
  });

  it("is active beyond the 60 day threshold", () => {
    expect(statusFromExpiry(inDays(EXPIRY_THRESHOLDS.soon + 1), NOW)).toBe("active");
  });
});

describe("toneFor", () => {
  it("puts needs_review off the urgency scale", () => {
    expect(toneFor("needs_review", inDays(2), NOW)).toBe("review");
  });

  it.each(["processing", "extraction_failed", "archived"] as const)(
    "treats %s as unknown regardless of the date",
    (status) => {
      expect(toneFor(status, inDays(2), NOW)).toBe("unknown");
    },
  );

  it("trusts an expired status", () => {
    expect(toneFor("expired", inDays(100), NOW)).toBe("expired");
  });

  it("is unknown for an active document with no expiry", () => {
    expect(toneFor("active", null, NOW)).toBe("unknown");
  });

  it("walks the ok, soon, warn, urgent, expired scale at the thresholds", () => {
    expect(toneFor("active", inDays(61), NOW)).toBe("ok");
    expect(toneFor("expiring", inDays(60), NOW)).toBe("soon");
    expect(toneFor("expiring", inDays(31), NOW)).toBe("soon");
    expect(toneFor("expiring", inDays(30), NOW)).toBe("warn");
    expect(toneFor("expiring", inDays(8), NOW)).toBe("warn");
    expect(toneFor("expiring", inDays(7), NOW)).toBe("urgent");
    expect(toneFor("expiring", inDays(0), NOW)).toBe("urgent");
    expect(toneFor("expiring", inDays(-1), NOW)).toBe("expired");
  });
});
