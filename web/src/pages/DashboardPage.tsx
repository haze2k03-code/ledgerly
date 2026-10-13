import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MonthPicker } from "../components/MonthPicker";
import { ProgressBar } from "../components/ProgressBar";
import {
  PAYMENT_LABELS,
  categoryColor,
  formatCompactINR,
  formatINR,
  monthLabel,
  thisMonth,
} from "../lib/format";
import { useQuery } from "../lib/graphql";
import { DASHBOARD } from "../lib/queries";
import type { Budget, Insight, MonthSummary } from "../lib/types";

interface DashboardData {
  monthSummary: MonthSummary;
  trend: { month: string; income: number; expense: number }[];
  budgets: Pick<Budget, "id" | "category" | "limit" | "spent" | "percentUsed">[];
  insights: Insight[];
}

const INCOME_COLOR = "#16a34a";
const EXPENSE_COLOR = "#e5484d";
const AXIS = { fill: "#8a8f98", fontSize: 12 };
const tooltipMoney = (value: unknown) => formatINR(Number(value));

const INSIGHT_ICONS: Record<Insight["severity"], string> = { WARNING: "!", GOOD: "✓", INFO: "i" };

export function DashboardPage() {
  const [month, setMonth] = useState(thisMonth());
  const { data, error, loading } = useQuery<DashboardData>(DASHBOARD, { month });
  const summary = data?.monthSummary;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Where your money went in {monthLabel(month)}.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      {error && <p className="error">{error}</p>}
      {!data && loading && <div className="page-loading">Loading your numbers…</div>}

      {summary && data && (
        <div className={loading ? "dashboard is-refreshing" : "dashboard"}>
          <section className="stats">
            <div className="card stat">
              <span className="stat-label">Income</span>
              <span className="stat-value income">{formatINR(summary.income)}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Expenses</span>
              <span className="stat-value expense">{formatINR(summary.expense)}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Balance</span>
              <span className={`stat-value ${summary.balance < 0 ? "expense" : ""}`}>{formatINR(summary.balance)}</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Savings rate</span>
              <span className="stat-value">{summary.savingsRate === null ? "–" : `${summary.savingsRate}%`}</span>
            </div>
          </section>

          <section className="card insights">
            <h2>Insights</h2>
            <ul>
              {data.insights.map((insight) => (
                <li key={insight.kind + insight.message} className={`insight insight-${insight.severity.toLowerCase()}`}>
                  <span className="insight-icon">{INSIGHT_ICONS[insight.severity]}</span>
                  {insight.message}
                </li>
              ))}
            </ul>
          </section>

          <section className="card chart-card">
            <h2>Spending by category</h2>
            {summary.byCategory.length === 0 ? (
              <p className="muted empty-chart">No expenses this month.</p>
            ) : (
              <div className="category-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={summary.byCategory}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {summary.byCategory.map((c) => (
                        <Cell key={c.category} fill={categoryColor(c.category)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tooltipMoney} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="legend-list">
                  {summary.byCategory.map((c) => (
                    <li key={c.category}>
                      <span className="dot" style={{ background: categoryColor(c.category) }} />
                      <span className="legend-name">{c.category}</span>
                      <span className="legend-amount">{formatINR(c.amount)}</span>
                      <span className="muted small legend-share">{c.share}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card chart-card">
            <h2>Daily spending</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={summary.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#8a8f9833" />
                <XAxis dataKey="date" tickFormatter={(d: string) => String(Number(d.slice(8)))} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={formatCompactINR} tick={AXIS} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={tooltipMoney} labelFormatter={(d) => String(d)} cursor={{ fill: "#8a8f981a" }} />
                <Bar dataKey="expense" name="Spent" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card chart-card">
            <h2>Last 6 months</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#8a8f9833" />
                <XAxis dataKey="month" tickFormatter={(m: string) => monthLabel(m, "short")} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatCompactINR} tick={AXIS} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={tooltipMoney} labelFormatter={(m) => monthLabel(String(m))} cursor={{ fill: "#8a8f981a" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Budgets</h2>
              <Link to="/budgets" className="small">
                Manage
              </Link>
            </div>
            {data.budgets.length === 0 ? (
              <p className="muted">
                No budgets for this month. <Link to="/budgets">Set one</Link> to get alerts before you overspend.
              </p>
            ) : (
              <ul className="budget-list compact">
                {data.budgets.map((b) => (
                  <li key={b.id}>
                    <div className="budget-row">
                      <span>{b.category}</span>
                      <span className="muted small">
                        {formatINR(b.spent)} / {formatINR(b.limit)}
                      </span>
                    </div>
                    <ProgressBar percent={b.percentUsed} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>How you paid</h2>
            {summary.byPaymentMethod.length === 0 ? (
              <p className="muted">No expenses this month.</p>
            ) : (
              <ul className="method-list">
                {summary.byPaymentMethod.map((p) => (
                  <li key={p.method}>
                    <span>{PAYMENT_LABELS[p.method]}</span>
                    <div className="method-bar">
                      <div style={{ width: `${(p.amount / summary.expense) * 100}%` }} />
                    </div>
                    <span className="legend-amount">{formatINR(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
