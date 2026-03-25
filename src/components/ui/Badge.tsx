interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  dot?: boolean;
}

const variants = {
  default: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200',
  success: 'bg-success-light text-green-700 ring-1 ring-inset ring-green-200',
  warning: 'bg-warning-light text-amber-700 ring-1 ring-inset ring-amber-200',
  error: 'bg-error-light text-red-700 ring-1 ring-inset ring-red-200',
};

const dotColors = {
  default: 'bg-gray-400',
  success: 'bg-success',
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
