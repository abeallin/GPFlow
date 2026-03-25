import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated';
}

const variantStyles = {
  default: 'bg-bg-raised border border-border shadow-[var(--shadow-sm)]',
  glass: 'glass-card',
  elevated:
    'bg-bg-raised border border-border shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 transition-all duration-300',
};

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  return (
    <div className={`rounded-xl ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
