import { describe, expect, it } from "vitest";
import { daysInMonth, isValidMonth, monthRange, parseDate, shiftMonth } from "../src/lib/dates.js";
import { formatINR, toPaise, toRupees } from "../src/lib/money.js";

describe("money", () => {
  it("converts rupees to whole paise without float errors", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(199.99)).toBe(19999);
    expect(toRupees(19999)).toBe(199.99);
  });

  it("formats with Indian digit grouping", () => {
    expect(formatINR(toPaise(125000))).toBe("₹1,25,000");
  });
});

describe("dates", () => {
  it("validates months", () => {
    expect(isValidMonth("2026-10")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-1")).toBe(false);
  });

  it("rejects impossible dates instead of rolling them over", () => {
    expect(parseDate("2026-02-30")).toBe(null);
    expect(parseDate("13-10-2026")).toBe(null);
    expect(parseDate("2026-10-13")?.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("builds a half-open month range", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
  });

  it("lists every day of the month, including leap days", () => {
    expect(daysInMonth("2028-02")).toHaveLength(29);
    expect(daysInMonth("2026-10")[30]).toBe("2026-10-31");
  });
});
