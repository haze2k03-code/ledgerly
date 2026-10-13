import { useEffect, useState, type FormEvent } from "react";
import { PAYMENT_LABELS, localToday } from "../lib/format";
import { gql, useQuery } from "../lib/graphql";
import { ADD_TRANSACTION, CATEGORIES, UPDATE_TRANSACTION } from "../lib/queries";
import { PAYMENT_METHODS, type Categories, type PaymentMethod, type Transaction, type TransactionType } from "../lib/types";

interface Props {
  /** Pass a transaction to edit it; leave empty to add a new one. */
  existing?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

export function TransactionForm({ existing, onClose, onSaved }: Props) {
  const { data } = useQuery<{ categories: Categories }>(CATEGORIES);
  const [type, setType] = useState<TransactionType>(existing?.type ?? "EXPENSE");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = data ? (type === "EXPENSE" ? data.categories.expense : data.categories.income) : [];

  // When switching between expense and income, pick a category that fits the new type.
  useEffect(() => {
    if (categories.length && !categories.includes(category)) setCategory(categories[0]);
  }, [categories, category]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      type,
      category,
      amount: Number(form.get("amount")),
      paymentMethod: form.get("paymentMethod") as PaymentMethod,
      date: String(form.get("date")),
      note: String(form.get("note") ?? ""),
    };
    setSaving(true);
    setError("");
    try {
      if (existing) await gql(UPDATE_TRANSACTION, { id: existing.id, input });
      else await gql(ADD_TRANSACTION, { input });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card modal" onSubmit={handleSubmit} aria-label={existing ? "Edit transaction" : "Add transaction"}>
        <div className="card-header">
          <h2>{existing ? "Edit transaction" : "Add transaction"}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="segmented">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button key={t} type="button" className={type === t ? `active ${t.toLowerCase()}` : ""} onClick={() => setType(t)}>
              {t === "EXPENSE" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label>
            Amount (₹)
            <input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              autoFocus
              defaultValue={existing?.amount}
            />
          </label>
          <label>
            Date
            <input name="date" type="date" required max={localToday()} defaultValue={existing?.date ?? localToday()} />
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Paid with
            <select name="paymentMethod" defaultValue={existing?.paymentMethod ?? "UPI"}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Note
            <input name="note" maxLength={200} placeholder="e.g. Dinner with friends" defaultValue={existing?.note} />
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving || !category}>
            {saving ? "Saving…" : existing ? "Save changes" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
