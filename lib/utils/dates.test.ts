import { describe, expect, it } from "vitest";
import { daysUntil, describeDayGap, formatDate, todayISO } from "./dates";

// 14:30 UTC on 2026-10-07. The time of day must never leak into the result.
const NOW = new Date("2026-10-07T14:30:00Z");

describe("daysUntil", () => {
  it("is zero on the day itself", () => {
    expect(daysUntil("2026-10-07", NOW)).toBe(0);
  });

  it("counts whole days ahead", () => {
    expect(daysUntil("2026-10-08", NOW)).toBe(1);
    expect(daysUntil("2026-11-06", NOW)).toBe(30);
  });

  it("is negative once the date has passed", () => {
    expect(daysUntil("2026-10-06", NOW)).toBe(-1);
  });

  it("ignores time of day", () => {
    expect(daysUntil("2026-10-08", new Date("2026-10-07T00:00:00Z"))).toBe(1);
    expect(daysUntil("2026-10-08", new Date("2026-10-07T23:59:59Z"))).toBe(1);
  });

  it("handles month and year boundaries and leap days", () => {
    expect(daysUntil("2027-01-01", new Date("2026-12-31T12:00:00Z"))).toBe(1);
    expect(daysUntil("2028-03-01", new Date("2028-02-28T12:00:00Z"))).toBe(2);
  });
});

describe("todayISO", () => {
  it("returns the UTC calendar date", () => {
    expect(todayISO(NOW)).toBe("2026-10-07");
    expect(todayISO(new Date("2026-10-07T23:59:59Z"))).toBe("2026-10-07");
  });
});

describe("describeDayGap", () => {
  it.each([
    [0, "today"],
    [1, "tomorrow"],
    [-1, "yesterday"],
    [12, "in 12 days"],
    [-8, "8 days ago"],
  ])("describes %i as %s", (days, expected) => {
    expect(describeDayGap(days)).toBe(expected);
  });
});

describe("formatDate", () => {
  it("formats an ISO date without shifting the day", () => {
    expect(formatDate("2027-03-12")).toBe("12 Mar 2027");
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
  });
});
