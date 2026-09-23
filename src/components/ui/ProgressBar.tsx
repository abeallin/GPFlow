interface ProgressBarProps {
  current: number;
  total: number;
  animate?: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({ current, total, animate = false, label = 'Progress', className = '' }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between text-xs font-medium tabular-nums">
        <span className="text-text-secondary">{current} / {total}</span>
        <span className="text-text-primary">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-busy={animate && percent < 100 ? true : undefined}
        className="w-full bg-bg-overlay rounded-full h-2 overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-250 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
