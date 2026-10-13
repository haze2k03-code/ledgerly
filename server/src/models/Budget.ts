import { Schema, model, type InferSchemaType } from "mongoose";

const budgetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // "YYYY-MM"
    limit: { type: Number, required: true, min: 1 }, // integer paise
  },
  { timestamps: true },
);

// One budget per user, category and month. The database enforces it, not just the code.
budgetSchema.index({ user: 1, month: 1, category: 1 }, { unique: true });

export type BudgetDoc = InferSchemaType<typeof budgetSchema>;
export const Budget = model("Budget", budgetSchema);
