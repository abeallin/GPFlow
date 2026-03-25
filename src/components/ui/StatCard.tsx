'use client';

import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon, className = '' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border border-border rounded-xl p-5 shadow-[var(--shadow-sm)] ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary [&>svg]:w-5 [&>svg]:h-5">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}
