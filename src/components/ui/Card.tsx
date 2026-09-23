import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `default`: a bordered panel. `elevated`: a shadowed panel (border OR shadow, never both). */
  variant?: 'default' | 'elevated';
}

const variantStyles = {
  default: 'bg-bg-raised border border-border',
  elevated: 'bg-bg-raised shadow-[var(--shadow-md)]',
};

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  return (
    <div className={`rounded-xl ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
