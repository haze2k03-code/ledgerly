// Creates a demo account with four months of realistic transactions and a few budgets,
// so the dashboard has something to show. Safe to re-run: it wipes and recreates the demo data.
// Usage: npm run seed   (in Docker: docker compose exec server node dist/scripts/seed.js)
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import type { PaymentMethod, TransactionType } from "../lib/categories.js";
import { currentMonth, daysInMonth, formatDate, parseDate, shiftMonth } from "../lib/dates.js";
import { toPaise } from "../lib/money.js";
import { connectDb } from "../db.js";
import { Budget } from "../models/Budget.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";

const DEMO_EMAIL = "demo@ledgerly.app";
const DEMO_PASSWORD = "Demo@1234";

// Small seeded random generator, so every run produces the same data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

interface Row {
  type: TransactionType;
  amount: number; // rupees
  category: string;
  paymentMethod: PaymentMethod;
  note: string;
  date: string;
}

function monthRows(month: string, isCurrent: boolean): Row[] {
  const today = formatDate(new Date());
  const days = daysInMonth(month).filter((d) => !isCurrent || d <= today);
  const rows: Row[] = [];
  const add = (day: string | undefined, r: Omit<Row, "date">) => day && rows.push({ ...r, date: day });

  add(days[0], { type: "INCOME", amount: 85000, category: "Salary", paymentMethod: "BANK_TRANSFER", note: "Monthly salary" });
  add(days[2], { type: "EXPENSE", amount: 22000, category: "Rent", paymentMethod: "BANK_TRANSFER", note: "House rent" });
  add(days[4], { type: "EXPENSE", amount: between(1400, 2600), category: "Utilities", paymentMethod: "UPI", note: "Electricity bill" });
  add(days[6], { type: "EXPENSE", amount: 799, category: "Utilities", paymentMethod: "CARD", note: "Broadband" });
  add(days[9], { type: "EXPENSE", amount: 649, category: "Subscriptions", paymentMethod: "CARD", note: "Video streaming" });
  add(days[11], { type: "EXPENSE", amount: 119, category: "Subscriptions", paymentMethod: "CARD", note: "Music streaming" });
  // A couple of bigger purchases early this month, so the "spending spike" insight shows
  // even when the current month is only a few days old.
  if (isCurrent) {
    add(days[1], { type: "EXPENSE", amount: 4999, category: "Shopping", paymentMethod: "CARD", note: "Smartwatch" });
    add(days[3], { type: "EXPENSE", amount: 2800, category: "Shopping", paymentMethod: "UPI", note: "Clothes" });
  }
  if (rand() < 0.6) add(days[18], { type: "INCOME", amount: between(8000, 20000), category: "Freelance", paymentMethod: "UPI", note: "Website project" });

  days.forEach((day, i) => {
    if (rand() < 0.7) {
      add(day, { type: "EXPENSE", amount: between(120, 650), category: "Food & Dining", paymentMethod: pick(["UPI", "UPI", "CARD", "WALLET"] as const), note: pick(["Lunch", "Dinner out", "Coffee", "Food delivery", "Snacks"]) });
    }
    if (i % 7 === 5) {
      add(day, { type: "EXPENSE", amount: between(1500, 3200), category: "Groceries", paymentMethod: "UPI", note: "Weekly groceries" });
    }
    if (rand() < 0.45) {
      add(day, { type: "EXPENSE", amount: between(60, 420), category: "Transport", paymentMethod: pick(["UPI", "CASH", "WALLET"] as const), note: pick(["Metro card recharge", "Auto ride", "Cab", "Fuel"]) });
    }
    // Make shopping noticeably higher this month so the "spending spike" insight appears.
    if (rand() < (isCurrent ? 0.18 : 0.07)) {
      add(day, { type: "EXPENSE", amount: between(800, 3500), category: "Shopping", paymentMethod: "CARD", note: pick(["Clothes", "Shoes", "Headphones", "Home decor"]) });
    }
    if (rand() < 0.1) {
      add(day, { type: "EXPENSE", amount: between(300, 1400), category: "Entertainment", paymentMethod: pick(["UPI", "CARD"] as const), note: pick(["Movie tickets", "Concert", "Gaming"]) });
    }
    if (rand() < 0.04) {
      add(day, { type: "EXPENSE", amount: between(250, 1800), category: "Health", paymentMethod: "UPI", note: pick(["Pharmacy", "Doctor visit"]) });
    }
  });

  return rows;
}

await connectDb();

const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
const user = await User.findOneAndUpdate(
  { email: DEMO_EMAIL },
  { $set: { name: "Demo User", passwordHash } },
  { upsert: true, new: true },
);
await Promise.all([Transaction.deleteMany({ user: user._id }), Budget.deleteMany({ user: user._id })]);

const thisMonth = currentMonth();
const rows = [3, 2, 1, 0].flatMap((back) => monthRows(shiftMonth(thisMonth, -back), back === 0));

await Transaction.insertMany(
  rows.map((r) => ({ ...r, user: user._id, amount: toPaise(r.amount), date: parseDate(r.date)! })),
);
await Budget.insertMany(
  [
    { category: "Food & Dining", limit: 8000 },
    { category: "Groceries", limit: 9000 },
    { category: "Shopping", limit: 5000 },
    { category: "Transport", limit: 3000 },
    { category: "Entertainment", limit: 2500 },
  ].map((b) => ({ ...b, limit: toPaise(b.limit), user: user._id, month: thisMonth })),
);

console.log(`Seeded ${rows.length} transactions and 5 budgets.`);
console.log(`Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
await mongoose.disconnect();
