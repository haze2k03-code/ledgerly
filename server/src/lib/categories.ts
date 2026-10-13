export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Education",
  "Travel",
  "Subscriptions",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Gifts", "Refunds", "Other income"] as const;

export const TRANSACTION_TYPES = ["EXPENSE", "INCOME"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = ["UPI", "CARD", "CASH", "BANK_TRANSFER", "WALLET"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isValidCategory(type: TransactionType, category: string): boolean {
  const list: readonly string[] = type === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return list.includes(category);
}
