import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated';
}

const variantStyles = {
  default: 'bg-white border border-border shadow-[var(--shadow-sm)]',
  glass: 'bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-[var(--shadow-glass)]',
  elevated: 'bg-white border border-border shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-shadow duration-300',
};

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  return (
    <div className={`rounded-xl ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
