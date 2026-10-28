export function AccuracyBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value < 0.5 ? "bg-destructive/80" : value < 0.8 ? "bg-warning" : "bg-success";
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  );
}
