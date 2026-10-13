import { Types } from "mongoose";
import { daysInMonth, monthRange, shiftMonth } from "../lib/dates.js";
import { Budget } from "../models/Budget.js";
import { Transaction } from "../models/Transaction.js";
import type { BudgetStatus, MonthFigures } from "./insights.js";

/**
 * All number crunching runs inside MongoDB with aggregation pipelines.
 * The database groups and sums the data and sends back a few small rows,
 * instead of shipping every transaction to Node and looping over them here.
 *
 * Amounts in and out of this file are integer paise.
 */

function matchUserInRange(userId: string, start: Date, end: Date) {
  return { user: new Types.ObjectId(userId), date: { $gte: start, $lt: end } };
}

export interface MonthBreakdown extends MonthFigures {
  daily: { date: string; expense: number; income: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

export async function getMonthBreakdown(userId: string, month: string): Promise<MonthBreakdown> {
  const { start, end } = monthRange(month);

  // $facet runs several groupings over the same matched documents in one round trip.
  const [result] = await Transaction.aggregate<{
    totals: { _id: string; amount: number }[];
    byCategory: { _id: string; amount: number }[];
    daily: { _id: { date: string; type: string }; amount: number }[];
    byPaymentMethod: { _id: string; amount: number }[];
  }>([
    { $match: matchUserInRange(userId, start, end) },
    {
      $facet: {
        totals: [{ $group: { _id: "$type", amount: { $sum: "$amount" } } }],
        byCategory: [
          { $match: { type: "EXPENSE" } },
          { $group: { _id: "$category", amount: { $sum: "$amount" } } },
          { $sort: { amount: -1 } },
        ],
        daily: [
          {
            $group: {
              _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, type: "$type" },
              amount: { $sum: "$amount" },
            },
          },
        ],
        byPaymentMethod: [
          { $match: { type: "EXPENSE" } },
          { $group: { _id: "$paymentMethod", amount: { $sum: "$amount" } } },
          { $sort: { amount: -1 } },
        ],
      },
    },
  ]);

  const totals = Object.fromEntries(result.totals.map((t) => [t._id, t.amount]));
  const dailyMap = new Map<string, { expense: number; income: number }>();
  for (const row of result.daily) {
    const day = dailyMap.get(row._id.date) ?? { expense: 0, income: 0 };
    if (row._id.type === "EXPENSE") day.expense = row.amount;
    else day.income = row.amount;
    dailyMap.set(row._id.date, day);
  }

  // Fill every day of the month so the chart has no gaps.
  const daily = daysInMonth(month).map((date) => ({ date, ...(dailyMap.get(date) ?? { expense: 0, income: 0 }) }));

  return {
    income: totals.INCOME ?? 0,
    expense: totals.EXPENSE ?? 0,
    byCategory: result.byCategory.map((c) => ({ category: c._id, amount: c.amount })),
    daily,
    byPaymentMethod: result.byPaymentMethod.map((p) => ({ method: p._id, amount: p.amount })),
  };
}

/** Income and expense per month for the last `months` months, ending with `endMonth`. */
export async function getTrend(
  userId: string,
  endMonth: string,
  months: number,
): Promise<{ month: string; income: number; expense: number }[]> {
  const firstMonth = shiftMonth(endMonth, -(months - 1));
  const { start } = monthRange(firstMonth);
  const { end } = monthRange(endMonth);

  const rows = await Transaction.aggregate<{ _id: { month: string; type: string }; amount: number }>([
    { $match: matchUserInRange(userId, start, end) },
    {
      $group: {
        _id: { month: { $dateToString: { format: "%Y-%m", date: "$date" } }, type: "$type" },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  return Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(firstMonth, i);
    const find = (type: string) => rows.find((r) => r._id.month === month && r._id.type === type)?.amount ?? 0;
    return { month, income: find("INCOME"), expense: find("EXPENSE") };
  });
}

/** Each budget for the month with how much has been spent in that category. */
export async function getBudgetStatuses(
  userId: string,
  month: string,
  spentByCategory?: { category: string; amount: number }[],
): Promise<(BudgetStatus & { id: string; month: string })[]> {
  const budgets = await Budget.find({ user: userId, month }).sort({ category: 1 }).lean();
  if (budgets.length === 0) return [];

  const spending = spentByCategory ?? (await getMonthBreakdown(userId, month)).byCategory;
  const spent = new Map(spending.map((c) => [c.category, c.amount]));

  return budgets.map((b) => ({
    id: String(b._id),
    month: b.month,
    category: b.category,
    limit: b.limit,
    spent: spent.get(b.category) ?? 0,
  }));
}
