import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

/**
 * "We could not ask" rendered as itself, never as an empty state (docs/ui-rules.md §6).
 * Not dismissable; always offers Retry; says what is safe.
 */
export function LoadError({
  title = "Couldn't load",
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-12 px-8 text-center rounded-xl border border-border bg-bg-raised">
      <AlertTriangle className="w-10 h-10 text-error-text mb-3" aria-hidden="true" />
      <p className="text-base font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary mt-1 max-w-sm">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" onClick={onRetry} pending={retrying} pendingLabel="Retrying…">Retry</Button>
      </div>
    </div>
  );
}
