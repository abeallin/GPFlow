'use client';

import { Info, AlertTriangle, XCircle, CheckCircle, X } from 'lucide-react';

interface AlertProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}

const config = {
  info: { icon: Info, border: 'border-l-info', iconColor: 'text-info' },
  warning: { icon: AlertTriangle, border: 'border-l-warning', iconColor: 'text-warning' },
  error: { icon: XCircle, border: 'border-l-error', iconColor: 'text-error-text' },
  success: { icon: CheckCircle, border: 'border-l-accent', iconColor: 'text-accent' },
};

export function Alert({ variant, title, children, onDismiss }: AlertProps) {
  const { icon: Icon, border, iconColor } = config[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`bg-bg-raised text-text-primary border border-border border-l-4 ${border} rounded-lg p-4 flex gap-3`}
    >
      <Icon className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm mb-0.5">{title}</p>}
        <div className="text-sm text-text-secondary">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -m-1 p-1 rounded-md text-text-muted hover:text-text-primary min-w-6 min-h-6"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
