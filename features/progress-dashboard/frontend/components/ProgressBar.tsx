export function ProgressBar({ percent }: { percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  const colour = pct >= 75 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}
