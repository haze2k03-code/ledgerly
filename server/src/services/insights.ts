import { formatINR } from "../lib/money.js";

/** All amounts in paise. */
export interface MonthFigures {
  income: number;
  expense: number;
  byCategory: { category: string; amount: number }[];
}

export interface BudgetStatus {
  category: string;
  limit: number;
  spent: number;
}

export type Severity = "GOOD" | "INFO" | "WARNING";

export interface Insight {
  kind: string;
  severity: Severity;
  message: string;
}

// A category only counts as "spiking" if it rose by 30%+ AND by at least ₹1,000,
// so a jump from ₹50 to ₹100 doesn't raise an alarm.
const SPIKE_RATIO = 1.3;
const SPIKE_MIN_PAISE = 1_000_00;
const BUDGET_WARN_RATIO = 0.8;

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/**
 * Turns this month's numbers (plus last month's and the budgets) into plain-English insights.
 * Kept as a pure function, with no database access, so it's easy to unit test.
 */
export function generateInsights(current: MonthFigures, previous: MonthFigures, budgets: BudgetStatus[]): Insight[] {
  const insights: Insight[] = [];

  if (current.income === 0 && current.expense === 0) {
    return [{ kind: "EMPTY", severity: "INFO", message: "No transactions this month yet. Add some to see insights." }];
  }

  // Budgets: over the limit, or close to it.
  for (const b of budgets) {
    if (b.spent > b.limit) {
      insights.push({
        kind: "BUDGET_EXCEEDED",
        severity: "WARNING",
        message: `You're over your ${b.category} budget by ${formatINR(b.spent - b.limit)}.`,
      });
    } else if (b.spent >= b.limit * BUDGET_WARN_RATIO) {
      insights.push({
        kind: "BUDGET_NEAR",
        severity: "INFO",
        message: `You've used ${percent(b.spent, b.limit)}% of your ${b.category} budget. ${formatINR(b.limit - b.spent)} left.`,
      });
    }
  }

  // Categories that jumped compared to last month.
  const previousByCategory = new Map(previous.byCategory.map((c) => [c.category, c.amount]));
  for (const c of current.byCategory) {
    const before = previousByCategory.get(c.category) ?? 0;
    if (before > 0 && c.amount >= before * SPIKE_RATIO && c.amount - before >= SPIKE_MIN_PAISE) {
      insights.push({
        kind: "CATEGORY_SPIKE",
        severity: "WARNING",
        message: `${c.category} spending is up ${percent(c.amount - before, before)}% from last month (${formatINR(c.amount - before)} more).`,
      });
    }
  }

  // Spending more than earning, or the savings rate.
  if (current.income > 0) {
    const saved = current.income - current.expense;
    const rate = percent(saved, current.income);
    if (saved < 0) {
      insights.push({
        kind: "OVERSPENT",
        severity: "WARNING",
        message: `You spent ${formatINR(-saved)} more than you earned this month.`,
      });
    } else {
      insights.push({
        kind: "SAVINGS_RATE",
        severity: rate >= 20 ? "GOOD" : "INFO",
        message:
          rate >= 20
            ? `Nice work: you saved ${rate}% of your income this month.`
            : `You saved ${rate}% of your income. Saving at least 20% is a common target.`,
      });
    }
  }

  // Total spending compared to last month.
  if (previous.expense > 0 && current.expense > 0) {
    const change = percent(current.expense - previous.expense, previous.expense);
    if (Math.abs(change) >= 5) {
      insights.push({
        kind: "MONTH_OVER_MONTH",
        severity: change < 0 ? "GOOD" : "INFO",
        message:
          change < 0
            ? `You've spent ${-change}% less than last month.`
            : `You've spent ${change}% more than last month.`,
      });
    }
  }

  // Biggest expense category.
  const top = [...current.byCategory].sort((a, b) => b.amount - a.amount)[0];
  if (top && current.expense > 0) {
    insights.push({
      kind: "TOP_CATEGORY",
      severity: "INFO",
      message: `${top.category} is your biggest expense: ${formatINR(top.amount)}, ${percent(top.amount, current.expense)}% of your spending.`,
    });
  }

  // Warnings first, then good news, then general info.
  const order: Record<Severity, number> = { WARNING: 0, GOOD: 1, INFO: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}
