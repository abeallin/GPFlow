'use client';

import { motion } from 'framer-motion';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-root
          ${checked ? 'bg-accent shadow-[var(--shadow-glow)]' : 'bg-[#2A2A3A]'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', duration: 0.2, bounce: 0.2 }}
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-[var(--shadow-sm)]
            ${checked ? 'ml-6' : 'ml-1'}`}
        />
      </button>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
}
