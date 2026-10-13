/** Green under 80%, amber from 80%, red once over budget. */
export function ProgressBar({ percent }: { percent: number }) {
  const level = percent > 100 ? "over" : percent >= 80 ? "near" : "ok";
  return (
    <div className={`progress progress-${level}`} role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}
