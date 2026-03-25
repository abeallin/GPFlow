import { type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-text-secondary">{label}</label>
      )}
      <div className="relative">
        <select
          className={`w-full px-3 py-2.5 bg-bg-input border border-border rounded-lg text-sm text-text-primary
            transition-all duration-200 appearance-none pr-10
            hover:border-border-strong
            focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent focus:shadow-[var(--shadow-glow)]
            ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      </div>
    </div>
  );
}
