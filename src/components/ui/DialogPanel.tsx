'use client';

import { useRef, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';

/**
 * A modal: its scrim, its panel, and the focus handling that makes it one.
 * The three attributes that make a dialog a dialog (`role`, `aria-modal`, a name)
 * live on the PANEL; the scrim stays presentational. See docs/ui-rules.md §5.
 */
export function DialogPanel({
  role = 'dialog',
  labelledBy,
  describedBy,
  className = '',
  initialFocus,
  onClose,
  children,
}: {
  role?: 'dialog' | 'alertdialog';
  /** id of the heading that names this dialog. */
  labelledBy: string;
  describedBy?: string;
  className?: string;
  /** CSS selector inside the panel that receives initial focus (e.g. the Cancel button). */
  initialFocus?: string;
  /** Called on Escape and on a scrim click. Omit for a dialog that must be answered. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose, initialFocus);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a scrim, not a control: it closes on click and Escape does the same through useDialogFocus
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-bg-root/70 p-4"
      onClick={onClose}
      data-dialog-scrim
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- event plumbing: stops a click inside the panel reaching the scrim */}
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-bg-raised border border-border shadow-[var(--shadow-lg)] p-6 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
