interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

// The pill is its tint plus the word. No dot: the word carries the state (docs/ui-rules.md §9).
const variants = {
  default: 'bg-bg-overlay text-text-secondary ring-1 ring-inset ring-border',
  success: 'bg-success-light text-accent ring-1 ring-inset ring-accent/20',
  warning: 'bg-warning-light text-warning ring-1 ring-inset ring-warning/20',
  error: 'bg-error-light text-error-text ring-1 ring-inset ring-error-text/20',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}
