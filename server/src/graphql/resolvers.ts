import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { z } from "zod";
import { clearAuthCookie, setAuthCookie, signToken, type AuthUser } from "../auth.js";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  isValidCategory,
} from "../lib/categories.js";
import { currentMonth, formatDate, isValidMonth, parseDate, shiftMonth } from "../lib/dates.js";
import { toPaise, toRupees } from "../lib/money.js";
import { RateLimiter } from "../lib/rateLimiter.js";
import { Budget } from "../models/Budget.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { getBudgetStatuses, getMonthBreakdown, getTrend } from "../services/analytics.js";
import { generateInsights } from "../services/insights.js";

export interface Context {
  req: Request;
  res: Response;
  user: AuthUser | null;
}

// ---------- helpers ----------

function requireUser(ctx: Context): AuthUser {
  if (!ctx.user) throw new GraphQLError("Please log in", { extensions: { code: "UNAUTHENTICATED" } });
  return ctx.user;
}

/** Validates resolver arguments with Zod and turns failures into a clean GraphQL error. */
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new GraphQLError(result.error.issues[0]?.message ?? "Invalid input", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return result.data;
}

function notFound(what: string): GraphQLError {
  return new GraphQLError(`${what} not found`, { extensions: { code: "NOT_FOUND" } });
}

// Escape regex characters so a search like "a.*(" matches literally and can't be used
// to run an expensive regular expression on the database.
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTransactionDTO(t: {
  _id: unknown;
  type: string;
  amount: number;
  category: string;
  paymentMethod: string;
  note?: string | null;
  date: Date;
}) {
  return {
    id: String(t._id),
    type: t.type,
    amount: toRupees(t.amount),
    category: t.category,
    paymentMethod: t.paymentMethod,
    note: t.note ?? "",
    date: formatDate(t.date),
  };
}

function toBudgetDTO(b: { id: string; category: string; month: string; limit: number; spent: number }) {
  return {
    id: b.id,
    category: b.category,
    month: b.month,
    limit: toRupees(b.limit),
    spent: toRupees(b.spent),
    remaining: toRupees(b.limit - b.spent),
    percentUsed: Math.round((b.spent / b.limit) * 1000) / 10,
  };
}

// ---------- input schemas ----------

const monthSchema = z.string().refine(isValidMonth, "Month must look like 2026-10");
const idSchema = z.string().refine((id) => mongoose.isValidObjectId(id), "Invalid id");
const dateSchema = z.string().refine((d) => parseDate(d) !== null, "Date must be a real date like 2026-10-13");

const transactionInputSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: z.number().positive("Amount must be more than zero").max(10_000_000, "Amount is too large"),
    category: z.string(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    note: z.string().trim().max(200, "Keep the note under 200 characters").nullish(),
    date: dateSchema,
  })
  .refine((t) => isValidCategory(t.type, t.category), { message: "That category doesn't match the transaction type" })
  .refine((t) => parseDate(t.date)! <= new Date(Date.now() + 24 * 60 * 60 * 1000), {
    message: "Date can't be in the future",
  });

function toTransactionFields(input: z.infer<typeof transactionInputSchema>) {
  return {
    type: input.type,
    amount: toPaise(input.amount),
    category: input.category,
    paymentMethod: input.paymentMethod,
    note: input.note ?? "",
    date: parseDate(input.date)!,
  };
}

const filterSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES).nullish(),
    category: z.string().max(50).nullish(),
    from: dateSchema.nullish(),
    to: dateSchema.nullish(),
    search: z.string().trim().max(100).nullish(),
  })
  .nullish();

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// 10 login attempts per IP + email every 15 minutes.
const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);

// ---------- resolvers ----------

export const resolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: Context) => ctx.user,

    categories: () => ({ expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES }),

    transactions: async (_: unknown, args: Record<string, unknown>, ctx: Context) => {
      const user = requireUser(ctx);
      const filter = parse(filterSchema, args.filter) ?? {};
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const offset = Math.min(Math.max(Number(args.offset) || 0, 0), 10_000);

      // Every query is scoped to the logged-in user. A user can never read someone else's data.
      const query: Record<string, unknown> = { user: user.id };
      if (filter.type) query.type = filter.type;
      if (filter.category) query.category = filter.category;
      if (filter.from || filter.to) {
        const range: Record<string, Date> = {};
        if (filter.from) range.$gte = parseDate(filter.from)!;
        if (filter.to) range.$lt = parseDate(shiftDay(filter.to, 1))!;
        query.date = range;
      }
      if (filter.search) query.note = { $regex: escapeRegex(filter.search), $options: "i" };

      const [items, total] = await Promise.all([
        Transaction.find(query).sort({ date: -1, _id: -1 }).skip(offset).limit(limit).lean(),
        Transaction.countDocuments(query),
      ]);
      return { items: items.map(toTransactionDTO), total, hasMore: offset + items.length < total };
    },

    monthSummary: async (_: unknown, args: { month: string }, ctx: Context) => {
      const user = requireUser(ctx);
      const month = parse(monthSchema, args.month);
      const m = await getMonthBreakdown(user.id, month);
      const balance = m.income - m.expense;

      return {
        month,
        income: toRupees(m.income),
        expense: toRupees(m.expense),
        balance: toRupees(balance),
        savingsRate: m.income > 0 ? Math.round((balance / m.income) * 1000) / 10 : null,
        byCategory: m.byCategory.map((c) => ({
          category: c.category,
          amount: toRupees(c.amount),
          share: m.expense > 0 ? Math.round((c.amount / m.expense) * 1000) / 10 : 0,
        })),
        byPaymentMethod: m.byPaymentMethod.map((p) => ({ method: p.method, amount: toRupees(p.amount) })),
        daily: m.daily.map((d) => ({ date: d.date, expense: toRupees(d.expense), income: toRupees(d.income) })),
      };
    },

    trend: async (_: unknown, args: { months?: number; endMonth?: string | null }, ctx: Context) => {
      const user = requireUser(ctx);
      const months = Math.min(Math.max(args.months ?? 6, 1), 24);
      const endMonth = args.endMonth ? parse(monthSchema, args.endMonth) : currentMonth();
      const rows = await getTrend(user.id, endMonth, months);
      return rows.map((r) => ({ month: r.month, income: toRupees(r.income), expense: toRupees(r.expense) }));
    },

    budgets: async (_: unknown, args: { month: string }, ctx: Context) => {
      const user = requireUser(ctx);
      const month = parse(monthSchema, args.month);
      return (await getBudgetStatuses(user.id, month)).map(toBudgetDTO);
    },

    insights: async (_: unknown, args: { month: string }, ctx: Context) => {
      const user = requireUser(ctx);
      const month = parse(monthSchema, args.month);
      const [current, previous] = await Promise.all([
        getMonthBreakdown(user.id, month),
        getMonthBreakdown(user.id, shiftMonth(month, -1)),
      ]);
      const budgets = await getBudgetStatuses(user.id, month, current.byCategory);
      return generateInsights(current, previous, budgets);
    },
  },

  Mutation: {
    register: async (_: unknown, args: unknown, ctx: Context) => {
      const { name, email, password } = parse(registerSchema, args);
      if (await User.exists({ email })) {
        throw new GraphQLError("An account with this email already exists", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
      setAuthCookie(ctx.res, signToken(String(user._id)));
      return { id: String(user._id), name: user.name, email: user.email };
    },

    login: async (_: unknown, args: unknown, ctx: Context) => {
      const { email, password } = parse(loginSchema, args);
      const limiterKey = `${ctx.req.ip}:${email}`;
      if (!loginLimiter.attempt(limiterKey)) {
        throw new GraphQLError("Too many attempts. Try again in 15 minutes.", {
          extensions: { code: "TOO_MANY_REQUESTS" },
        });
      }

      const user = await User.findOne({ email }).lean();
      // Same message for unknown email and wrong password, so nobody can probe which emails exist.
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new GraphQLError("Invalid email or password", { extensions: { code: "UNAUTHENTICATED" } });
      }

      loginLimiter.reset(limiterKey);
      setAuthCookie(ctx.res, signToken(String(user._id)));
      return { id: String(user._id), name: user.name, email: user.email };
    },

    logout: (_: unknown, __: unknown, ctx: Context) => {
      clearAuthCookie(ctx.res);
      return true;
    },

    addTransaction: async (_: unknown, args: { input: unknown }, ctx: Context) => {
      const user = requireUser(ctx);
      const input = parse(transactionInputSchema, args.input);
      const created = await Transaction.create({ ...toTransactionFields(input), user: user.id });
      return toTransactionDTO(created);
    },

    updateTransaction: async (_: unknown, args: { id: unknown; input: unknown }, ctx: Context) => {
      const user = requireUser(ctx);
      const id = parse(idSchema, args.id);
      const input = parse(transactionInputSchema, args.input);
      // Matching on both _id AND user means you can only edit your own transactions,
      // even if you guess another user's transaction id.
      const updated = await Transaction.findOneAndUpdate({ _id: id, user: user.id }, toTransactionFields(input), {
        new: true,
        runValidators: true,
      }).lean();
      if (!updated) throw notFound("Transaction");
      return toTransactionDTO(updated);
    },

    deleteTransaction: async (_: unknown, args: { id: unknown }, ctx: Context) => {
      const user = requireUser(ctx);
      const id = parse(idSchema, args.id);
      const { deletedCount } = await Transaction.deleteOne({ _id: id, user: user.id });
      if (deletedCount === 0) throw notFound("Transaction");
      return true;
    },

    setBudget: async (_: unknown, args: unknown, ctx: Context) => {
      const user = requireUser(ctx);
      const { category, month, limit } = parse(
        z.object({
          category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: "Pick an expense category" }) }),
          month: monthSchema,
          limit: z.number().positive("Budget must be more than zero").max(10_000_000),
        }),
        args,
      );
      // Upsert: update the budget if one exists for this category and month, otherwise create it.
      await Budget.findOneAndUpdate(
        { user: user.id, month, category },
        { $set: { limit: toPaise(limit) } },
        { upsert: true, runValidators: true },
      );
      const status = (await getBudgetStatuses(user.id, month)).find((b) => b.category === category)!;
      return toBudgetDTO(status);
    },

    deleteBudget: async (_: unknown, args: { id: unknown }, ctx: Context) => {
      const user = requireUser(ctx);
      const id = parse(idSchema, args.id);
      const { deletedCount } = await Budget.deleteOne({ _id: id, user: user.id });
      if (deletedCount === 0) throw notFound("Budget");
      return true;
    },
  },
};

function shiftDay(date: string, days: number): string {
  const d = parseDate(date)!;
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}
