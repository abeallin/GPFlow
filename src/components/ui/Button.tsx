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
  primary: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-600',
  secondary: 'bg-white text-gray-700 border border-gray-200 shadow-[var(--shadow-sm)] hover:bg-gray-50 hover:border-gray-300',
  danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md hover:shadow-lg',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
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
        focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
