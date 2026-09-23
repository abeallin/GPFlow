import { useId, type InputHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { fieldClasses, FieldShell, useFieldIds } from './field';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, hint, error, icon, className = '', id, ...props }: InputProps) {
  const autoId = useId();
  const ids = useFieldIds(id ?? autoId, { hint, error });

  return (
    <FieldShell label={label} hint={hint} error={error} ids={ids}>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
            {icon}
          </div>
        )}
        <input
          id={ids.control}
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          className={`${fieldClasses(Boolean(error))} ${icon ? 'pl-10' : ''} ${className}`}
          {...props}
        />
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-error-text" aria-hidden="true">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>
    </FieldShell>
  );
}
