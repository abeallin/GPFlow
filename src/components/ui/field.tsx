import type { ReactNode } from 'react';

/**
 * Shared shape for every field (docs/ui-rules.md §8): a visible label tied by
 * htmlFor/id, a hint and an error below, both linked through aria-describedby.
 */
export interface FieldIds {
  control: string;
  hint?: string;
  error?: string;
  describedBy?: string;
}

export function useFieldIds(controlId: string, parts: { hint?: string; error?: string }): FieldIds {
  const hint = parts.hint ? `${controlId}-hint` : undefined;
  const error = parts.error ? `${controlId}-error` : undefined;
  const describedBy = [hint, error].filter(Boolean).join(' ') || undefined;
  return { control: controlId, hint, error, describedBy };
}

export function fieldClasses(invalid: boolean): string {
  return `w-full min-h-10 px-3 py-2 bg-bg-input border rounded-lg text-sm text-text-primary
    transition-colors duration-150 placeholder:text-text-muted
    hover:border-border-strong focus:border-accent
    ${invalid ? 'border-error-text' : 'border-edge'}`;
}

export function FieldShell({
  label,
  hint,
  error,
  ids,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  ids: FieldIds;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={ids.control} className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      {children}
      {hint && <p id={ids.hint} className="text-xs text-text-muted">{hint}</p>}
      {error && <p id={ids.error} className="text-xs text-error-text">{error}</p>}
    </div>
  );
}
