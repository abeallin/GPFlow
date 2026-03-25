'use client';

import { motion } from 'framer-motion';
import { Info, AlertTriangle, XCircle, CheckCircle, X } from 'lucide-react';

interface AlertProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}

const config = {
  info: { icon: Info, bg: 'bg-info-light', border: 'border-l-info', text: 'text-text-primary', iconColor: 'text-info' },
  warning: { icon: AlertTriangle, bg: 'bg-warning-light', border: 'border-l-warning', text: 'text-text-primary', iconColor: 'text-warning' },
  error: { icon: XCircle, bg: 'bg-error-light', border: 'border-l-error', text: 'text-text-primary', iconColor: 'text-error' },
  success: { icon: CheckCircle, bg: 'bg-success-light', border: 'border-l-success', text: 'text-text-primary', iconColor: 'text-accent' },
};

export function Alert({ variant, title, children, onDismiss }: AlertProps) {
  const { icon: Icon, bg, border, text, iconColor } = config[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`${bg} ${text} border-l-4 ${border} rounded-lg p-4 flex gap-3`}
    >
      <Icon className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm mb-0.5">{title}</p>}
        <div className="text-sm text-text-secondary">{children}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-text-muted hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
