'use client';

import { useId, useState, type ReactNode } from 'react';
import { DialogPanel } from './DialogPanel';
import { Button } from './Button';

/**
 * Confirmation for irreversible or bulk actions (docs/ui-rules.md §5).
 * Cancel comes first and takes initial focus. Confirming relabels the button and refuses a
 * second press; a failure keeps the dialog open, shows the error and says what is safe.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  tone = 'default',
  safeMessage = 'Nothing has changed.',
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  /** Appended to a failure so the user knows what it cost them. */
  safeMessage?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  };

  return (
    <DialogPanel
      role="alertdialog"
      labelledBy={titleId}
      describedBy={body ? bodyId : undefined}
      initialFocus="[data-dialog-cancel]"
      onClose={pending ? undefined : onCancel}
    >
      <h2 id={titleId} className="text-lg text-text-primary">{title}</h2>
      {body && <div id={bodyId} className="mt-2 text-sm text-text-secondary">{body}</div>}

      {error && (
        <p role="alert" className="mt-4 text-sm text-error-text">
          {error} {safeMessage}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onCancel} data-dialog-cancel disabledReason={undefined} pending={false} {...(pending ? { disabled: true } : {})}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'destructive' ? 'destructive' : 'primary'}
          onClick={confirm}
          pending={pending}
          pendingLabel={pendingLabel}
        >
          {confirmLabel}
        </Button>
      </div>
    </DialogPanel>
  );
}
