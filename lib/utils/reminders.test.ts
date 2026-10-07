import { describe, expect, it } from "vitest";
import { tierFor } from "./reminders";
import { EXPIRY_THRESHOLDS } from "./status";

describe("tierFor", () => {
  it("returns null while more than 60 days remain", () => {
    expect(tierFor(61)).toBeNull();
    expect(tierFor(365)).toBeNull();
  });

  it.each([
    [60, "t60"],
    [31, "t60"],
    [30, "t30"],
    [8, "t30"],
    [7, "t7"],
    [2, "t7"],
    [1, "t1"],
    [0, "t1"],
    [-1, "overdue"],
    [-400, "overdue"],
  ])("maps %i days out to %s", (days, tier) => {
    expect(tierFor(days)).toBe(tier);
  });

  it("only ever returns the single most urgent tier", () => {
    // A document filed 3 days before expiry is inside every wider window, but
    // must produce one notice rather than the whole ladder.
    expect(tierFor(3)).toBe("t7");
  });

  it("gets steadily more urgent as the expiry approaches", () => {
    const order = ["t60", "t30", "t7", "t1", "overdue"];
    let last = -1;
    for (let days = 60; days >= -5; days--) {
      const tier = tierFor(days);
      if (tier === null) continue;
      const rank = order.indexOf(tier);
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
  });

  it("agrees with the dashboard thresholds, so the two never disagree", () => {
    expect(tierFor(EXPIRY_THRESHOLDS.soon)).toBe("t60");
    expect(tierFor(EXPIRY_THRESHOLDS.soon + 1)).toBeNull();
    expect(tierFor(EXPIRY_THRESHOLDS.warn)).toBe("t30");
    expect(tierFor(EXPIRY_THRESHOLDS.urgent)).toBe("t7");
  });
});
