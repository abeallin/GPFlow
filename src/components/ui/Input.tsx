import { type InputHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-text-secondary">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </div>
        )}
        <input
          className={`w-full px-3 py-2.5 bg-bg-input border rounded-lg text-sm text-text-primary
            transition-all duration-200
            placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent focus:shadow-[var(--shadow-glow)]
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-error ring-2 ring-error/20' : 'border-border hover:border-border-strong'}
            ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-error">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-error flex items-center gap-1">{error}</p>}
    </div>
  );
}
