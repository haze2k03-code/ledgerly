import { useState, type FormEvent } from "react";
import { MonthPicker } from "../components/MonthPicker";
import { ProgressBar } from "../components/ProgressBar";
import { formatINR, monthLabel, thisMonth } from "../lib/format";
import { gql, useQuery } from "../lib/graphql";
import { BUDGETS, CATEGORIES, DELETE_BUDGET, SET_BUDGET } from "../lib/queries";
import type { Budget, Categories } from "../lib/types";

export function BudgetsPage() {
  const [month, setMonth] = useState(thisMonth());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: categoriesData } = useQuery<{ categories: Categories }>(CATEGORIES);
  const { data, loading, refetch } = useQuery<{ budgets: Budget[] }>(BUDGETS, { month });

  const budgets = data?.budgets ?? [];
  const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    setError("");
    try {
      await gql(SET_BUDGET, { category: values.get("category"), month, limit: Number(values.get("limit")) });
      form.reset();
      refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: Budget) {
    if (!confirm(`Remove the ${b.category} budget for ${monthLabel(month)}?`)) return;
    await gql(DELETE_BUDGET, { id: b.id }).catch((err: Error) => setError(err.message));
    refetch();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Budgets</h1>
          <p className="muted">Set a monthly limit per category. Setting one again updates it.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <section className="card">
        <h2>Set a budget for {monthLabel(month)}</h2>
        <form className="budget-form" onSubmit={handleSubmit}>
          <label>
            Category
            <select name="category" required>
              {categoriesData?.categories.expense.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Monthly limit (₹)
            <input name="limit" type="number" min="1" step="1" required placeholder="5000" />
          </label>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save budget"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className={`card ${loading ? "is-refreshing" : ""}`}>
        <div className="card-header">
          <h2>{monthLabel(month)}</h2>
          {budgets.length > 0 && (
            <span className="muted small">
              {formatINR(totalSpent)} spent of {formatINR(totalLimit)} budgeted
            </span>
          )}
        </div>

        {budgets.length === 0 ? (
          <p className="muted">No budgets for this month yet.</p>
        ) : (
          <ul className="budget-list">
            {budgets.map((b) => (
              <li key={b.id}>
                <div className="budget-row">
                  <strong>{b.category}</strong>
                  <span className="budget-figures">
                    <span>
                      {formatINR(b.spent)} <span className="muted">of {formatINR(b.limit)}</span>
                    </span>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => void remove(b)}>
                      Remove
                    </button>
                  </span>
                </div>
                <ProgressBar percent={b.percentUsed} />
                <span className={`small ${b.remaining < 0 ? "error-text" : "muted"}`}>
                  {b.remaining < 0 ? `${formatINR(-b.remaining)} over budget` : `${formatINR(b.remaining)} left · ${b.percentUsed}% used`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
