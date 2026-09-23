import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { fieldClasses, FieldShell, useFieldIds } from './field';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Select({ label, hint, error, className = '', id, children, ...props }: SelectProps) {
  const autoId = useId();
  const ids = useFieldIds(id ?? autoId, { hint, error });

  return (
    <FieldShell label={label} hint={hint} error={error} ids={ids}>
      <div className="relative">
        <select
          id={ids.control}
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          className={`${fieldClasses(Boolean(error))} appearance-none pr-10 ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
      </div>
    </FieldShell>
  );
}
