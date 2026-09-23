interface StatCardProps {
  label: string;
  /** null = unknown (not loaded or failed). Renders a dash; a zero is a claim. */
  value: string | number | null;
  icon: React.ReactNode;
  className?: string;
}

export const EMPTY_DASH = '—';

export function StatCard({ label, value, icon, className = '' }: StatCardProps) {
  const unknown = value === null || value === undefined;
  return (
    <div className={`bg-bg-raised border border-border rounded-xl p-5 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-subtle text-accent [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-text-primary tabular-nums" aria-label={unknown ? `${label}: unknown` : undefined}>
            {unknown ? EMPTY_DASH : value}
          </p>
          <p className="text-xs font-medium text-text-secondary">{label}</p>
        </div>
      </div>
    </div>
  );
}
