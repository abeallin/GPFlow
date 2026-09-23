'use client';

import { useId, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * The house button. See docs/ui-rules.md §4.
 *
 * - Four variants; `destructive` is a solid error fill and belongs inside ConfirmDialog.
 * - Unavailable means `aria-disabled` + a stated reason, and the press is refused in the
 *   handler. The control keeps its place in the tab order so the reason can be read.
 * - A working button (`pending`) keeps its width and says what it is doing.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Why the control can't act right now. Rendered beside the button and linked by aria-describedby. */
  disabledReason?: string;
  /** Unavailable without a visible reason (use sparingly; prefer disabledReason). */
  disabled?: boolean;
  /** Working: aria-busy, refuses presses, shows `pendingLabel` in place of children. */
  pending?: boolean;
  pendingLabel?: string;
  /** @deprecated use `pending` */
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-on-accent hover:bg-accent-hover',
  secondary: 'bg-transparent text-text-primary border border-edge hover:bg-bg-overlay',
  destructive: 'bg-error text-white hover:brightness-110',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-overlay hover:text-text-primary',
};

const sizes = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-6 text-sm',
};

const unavailable =
  'aria-disabled:bg-disabled-fill aria-disabled:text-disabled-ink aria-disabled:border aria-disabled:border-edge aria-disabled:cursor-not-allowed aria-disabled:hover:bg-disabled-fill aria-disabled:hover:brightness-100';

export function Button({
  variant = 'primary',
  size = 'md',
  disabledReason,
  disabled = false,
  pending = false,
  pendingLabel,
  loading = false,
  icon,
  className = '',
  children,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const reasonId = useId();
  const busy = pending || loading;
  const isUnavailable = busy || disabled || Boolean(disabledReason);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (isUnavailable) {
      // preventDefault matters for type="submit": aria-disabled does not stop a form submission.
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const describedBy = [props['aria-describedby'], disabledReason ? reasonId : null].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <button
        type={type}
        aria-disabled={isUnavailable || undefined}
        aria-busy={busy || undefined}
        aria-describedby={describedBy}
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors duration-150 cursor-pointer
          ${variants[variant]} ${sizes[size]} ${unavailable} ${className}`}
        {...props}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon}
        {busy && pendingLabel ? pendingLabel : children}
      </button>
      {disabledReason && (
        <span id={reasonId} className="block text-xs text-text-secondary mt-1.5">
          {disabledReason}
        </span>
      )}
    </>
  );
}
