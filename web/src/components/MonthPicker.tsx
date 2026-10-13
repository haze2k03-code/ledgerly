import { monthLabel, shiftMonth, thisMonth } from "../lib/format";

export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const isCurrent = month >= thisMonth();
  return (
    <div className="month-picker">
      <button className="btn btn-ghost btn-icon" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <span className="month-label">{monthLabel(month)}</span>
      <button
        className="btn btn-ghost btn-icon"
        aria-label="Next month"
        disabled={isCurrent}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        ›
      </button>
    </div>
  );
}
