import { useCallback, useEffect, useState } from "react";
import { TransactionForm } from "../components/TransactionForm";
import { PAYMENT_LABELS, categoryColor, dateLabel, formatINRExact } from "../lib/format";
import { gql, useQuery } from "../lib/graphql";
import { CATEGORIES, DELETE_TRANSACTION, TRANSACTIONS } from "../lib/queries";
import type { Categories, Transaction, TransactionType } from "../lib/types";

const PAGE_SIZE = 20;

interface Filters {
  type: TransactionType | "";
  category: string;
  search: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { type: "", category: "", search: "", from: "", to: "" };

/** Waits until the user stops typing before using the value, so we don't query on every keystroke. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function TransactionsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  const search = useDebounced(filters.search);

  const { data: categoriesData } = useQuery<{ categories: Categories }>(CATEGORIES);
  const { data, error, loading, refetch } = useQuery<{
    transactions: { items: Transaction[]; total: number; hasMore: boolean };
  }>(TRANSACTIONS, {
    // Only send filters that are set; GraphQL treats missing fields as "no filter".
    filter: {
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...(search && { search }),
      ...(filters.from && { from: filters.from }),
      ...(filters.to && { to: filters.to }),
    },
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  async function remove(t: Transaction) {
    if (!confirm(`Delete "${t.note || t.category}" (${formatINRExact(t.amount)})?`)) return;
    try {
      await gql(DELETE_TRANSACTION, { id: t.id });
      refetch();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const closeForm = useCallback(() => setEditing(null), []);
  const onSaved = useCallback(() => {
    setEditing(null);
    refetch();
  }, [refetch]);

  const result = data?.transactions;
  const allCategories = categoriesData ? [...categoriesData.categories.expense, ...categoriesData.categories.income] : [];
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="muted">{result ? `${result.total} transaction${result.total === 1 ? "" : "s"}` : " "}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          + Add transaction
        </button>
      </header>

      <section className="card filters">
        <input
          type="search"
          placeholder="Search notes…"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          aria-label="Search notes"
        />
        <select value={filters.type} onChange={(e) => updateFilter("type", e.target.value as Filters["type"])} aria-label="Type">
          <option value="">All types</option>
          <option value="EXPENSE">Expenses</option>
          <option value="INCOME">Income</option>
        </select>
        <select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {allCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} aria-label="From date" />
        <input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} aria-label="To date" />
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(0);
            }}>
            Clear
          </button>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <section className={`card table-card ${loading ? "is-refreshing" : ""}`}>
        {result && result.items.length === 0 ? (
          <div className="empty-state">
            <p>{hasFilters ? "No transactions match these filters." : "No transactions yet."}</p>
            {!hasFilters && (
              <button className="btn btn-primary" onClick={() => setEditing("new")}>
                Add your first one
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th>Category</th>
                  <th>Paid with</th>
                  <th className="right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result?.items.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap muted">{dateLabel(t.date)}</td>
                    <td>{t.note || <span className="muted">No note</span>}</td>
                    <td>
                      <span className="tag">
                        <span className="dot" style={{ background: t.type === "INCOME" ? "#16a34a" : categoryColor(t.category) }} />
                        {t.category}
                      </span>
                    </td>
                    <td className="muted">{PAYMENT_LABELS[t.paymentMethod]}</td>
                    <td className={`right nowrap amount ${t.type === "INCOME" ? "income" : ""}`}>
                      {t.type === "INCOME" ? "+" : "−"}
                      {formatINRExact(t.amount)}
                    </td>
                    <td className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost btn-sm btn-danger" onClick={() => void remove(t)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && result.total > PAGE_SIZE && (
          <div className="pagination">
            <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Newer
            </button>
            <span className="muted small">
              Page {page + 1} of {Math.ceil(result.total / PAGE_SIZE)}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={!result.hasMore} onClick={() => setPage((p) => p + 1)}>
              Older →
            </button>
          </div>
        )}
      </section>

      {editing && (
        <TransactionForm existing={editing === "new" ? undefined : editing} onClose={closeForm} onSaved={onSaved} />
      )}
    </div>
  );
}
