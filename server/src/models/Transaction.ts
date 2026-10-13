import { Schema, model, type InferSchemaType } from "mongoose";
import { PAYMENT_METHODS, TRANSACTION_TYPES } from "../lib/categories.js";

const transactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    // Integer paise, see lib/money.ts.
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "amount must be whole paise" },
    },
    category: { type: String, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    note: { type: String, trim: true, maxlength: 200, default: "" },
    date: { type: Date, required: true },
  },
  { timestamps: true },
);

// Compound indexes matching how we query: always by user, usually by date range,
// often also by category. The user field comes first so each user's data is one index range.
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = model("Transaction", transactionSchema);
