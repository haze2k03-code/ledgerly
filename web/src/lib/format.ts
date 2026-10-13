import type { PaymentMethod } from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export const formatINR = (rupees: number) => inr.format(rupees);
export const formatINRExact = (rupees: number) => inrExact.format(rupees);

/** Short axis labels: 1500 -> "₹1.5k", 250000 -> "₹2.5L" */
export function formatCompactINR(rupees: number): string {
  if (rupees >= 100000) return `₹${+(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${+(rupees / 1000).toFixed(1)}k`;
  return `₹${Math.round(rupees)}`;
}

// Calendar helpers. Months are "YYYY-MM" strings; dates are "YYYY-MM-DD".
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const thisMonth = () => localToday().slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
    timeZone: "UTC",
  });
}

export function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  UPI: "UPI",
  CARD: "Card",
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  WALLET: "Wallet",
};

// A fixed colour per category, so "Food" is the same colour on every chart.
const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#db2777", "#7c3aed", "#0891b2", "#ea580c", "#65a30d", "#dc2626", "#0d9488", "#9333ea", "#64748b"];
const CATEGORY_ORDER = ["Food & Dining", "Groceries", "Rent", "Utilities", "Transport", "Shopping", "Entertainment", "Health", "Education", "Travel", "Subscriptions", "Other"];

export function categoryColor(category: string): string {
  const i = CATEGORY_ORDER.indexOf(category);
  return PALETTE[(i === -1 ? category.length : i) % PALETTE.length];
}
