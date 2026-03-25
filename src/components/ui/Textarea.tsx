import { type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-text-secondary">{label}</label>
      )}
      <textarea
        className={`w-full px-3 py-2.5 bg-bg-input border rounded-lg text-sm text-text-primary
          transition-all duration-200 resize-y min-h-[100px]
          placeholder:text-text-muted
          hover:border-border-strong
          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent focus:shadow-[var(--shadow-glow)]
          ${error ? 'border-error ring-2 ring-error/20' : 'border-border'}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
