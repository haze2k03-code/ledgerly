export interface User {
  id: string;
  name: string;
  email: string;
}

export type TransactionType = "EXPENSE" | "INCOME";
export type PaymentMethod = "UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "WALLET";
export const PAYMENT_METHODS: PaymentMethod[] = ["UPI", "CARD", "CASH", "BANK_TRANSFER", "WALLET"];

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  note: string;
  date: string;
}

export interface Categories {
  expense: string[];
  income: string[];
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
  savingsRate: number | null;
  byCategory: { category: string; amount: number; share: number }[];
  byPaymentMethod: { method: PaymentMethod; amount: number }[];
  daily: { date: string; expense: number; income: number }[];
}

export interface Budget {
  id: string;
  category: string;
  month: string;
  limit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export interface Insight {
  kind: string;
  severity: "GOOD" | "INFO" | "WARNING";
  message: string;
}
