import { describe, expect, it } from "vitest";
import { generateInsights, type MonthFigures } from "../src/services/insights.js";

const p = (rupees: number) => rupees * 100; // test helper: rupees -> paise

const lastMonth: MonthFigures = {
  income: p(80000),
  expense: p(50000),
  byCategory: [
    { category: "Rent", amount: p(22000) },
    { category: "Shopping", amount: p(3000) },
    { category: "Food & Dining", amount: p(6000) },
  ],
};

describe("generateInsights", () => {
  it("returns a single hint when the month is empty", () => {
    const result = generateInsights({ income: 0, expense: 0, byCategory: [] }, lastMonth, []);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("EMPTY");
  });

  it("praises a savings rate of 20% or more", () => {
    const current: MonthFigures = { income: p(100000), expense: p(60000), byCategory: [{ category: "Rent", amount: p(22000) }] };
    const savings = generateInsights(current, lastMonth, []).find((i) => i.kind === "SAVINGS_RATE");
    expect(savings?.severity).toBe("GOOD");
    expect(savings?.message).toContain("40%");
  });

  it("warns when spending is more than income", () => {
    const current: MonthFigures = { income: p(30000), expense: p(45000), byCategory: [{ category: "Rent", amount: p(22000) }] };
    const result = generateInsights(current, lastMonth, []);
    expect(result.find((i) => i.kind === "OVERSPENT")?.message).toContain("₹15,000");
  });

  it("flags a category that jumped by 30% and ₹1,000 or more", () => {
    const current: MonthFigures = {
      income: p(80000),
      expense: p(55000),
      byCategory: [
        { category: "Rent", amount: p(22000) },
        { category: "Shopping", amount: p(6000) },
        { category: "Food & Dining", amount: p(6500) },
      ],
    };
    const spikes = generateInsights(current, lastMonth, []).filter((i) => i.kind === "CATEGORY_SPIKE");
    expect(spikes).toHaveLength(1);
    expect(spikes[0].message).toContain("Shopping");
    expect(spikes[0].message).toContain("100%");
  });

  it("reports budgets that are exceeded or nearly used", () => {
    const current: MonthFigures = { income: p(80000), expense: p(40000), byCategory: [] };
    const result = generateInsights(current, lastMonth, [
      { category: "Shopping", limit: p(5000), spent: p(6200) },
      { category: "Transport", limit: p(3000), spent: p(2700) },
      { category: "Groceries", limit: p(9000), spent: p(2000) },
    ]);
    expect(result.find((i) => i.kind === "BUDGET_EXCEEDED")?.message).toContain("₹1,200");
    expect(result.find((i) => i.kind === "BUDGET_NEAR")?.message).toContain("90%");
    expect(result.filter((i) => i.kind.startsWith("BUDGET"))).toHaveLength(2);
  });

  it("puts warnings first", () => {
    const current: MonthFigures = { income: p(30000), expense: p(45000), byCategory: [{ category: "Rent", amount: p(22000) }] };
    expect(generateInsights(current, lastMonth, [])[0].severity).toBe("WARNING");
  });
});
