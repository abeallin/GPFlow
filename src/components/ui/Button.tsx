'use client';

import { type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants = {
  primary:
    'bg-accent text-text-on-accent shadow-[var(--shadow-md)] hover:bg-accent-hover hover:shadow-[var(--shadow-glow)] focus-visible:ring-accent/50',
  secondary:
    'glass-card text-text-primary border border-border hover:border-border-strong hover:bg-bg-overlay focus-visible:ring-accent/30',
  danger:
    'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[var(--shadow-md)] hover:from-red-700 hover:to-rose-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] focus-visible:ring-red-500/50',
  ghost:
    'bg-transparent text-text-secondary hover:bg-bg-overlay hover:text-text-primary focus-visible:ring-accent/30',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 cursor-pointer
        active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-root
        ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
