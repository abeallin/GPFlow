import { useId, type TextareaHTMLAttributes } from 'react';
import { fieldClasses, FieldShell, useFieldIds } from './field';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, className = '', id, ...props }: TextareaProps) {
  const autoId = useId();
  const ids = useFieldIds(id ?? autoId, { hint, error });

  return (
    <FieldShell label={label} hint={hint} error={error} ids={ids}>
      <textarea
        id={ids.control}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        className={`${fieldClasses(Boolean(error))} resize-y min-h-[100px] ${className}`}
        {...props}
      />
    </FieldShell>
  );
}
