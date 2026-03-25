interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  dot?: boolean;
}

const variants = {
  default: 'bg-bg-overlay text-text-secondary ring-1 ring-inset ring-border',
  success: 'bg-success-light text-accent ring-1 ring-inset ring-accent/20',
  warning: 'bg-warning-light text-warning ring-1 ring-inset ring-warning/20',
  error: 'bg-error-light text-error ring-1 ring-inset ring-error/20',
};

const dotColors = {
  default: 'bg-text-muted',
  success: 'bg-accent',
  warning: 'bg-warning',
  error: 'bg-error',
};

export function Badge({ children, variant = 'default', dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-150 ${variants[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
