'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  current: number;
  total: number;
  animate?: boolean;
  className?: string;
}

export function ProgressBar({ current, total, animate = false, className = '' }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between text-xs font-medium">
        <span className="text-text-secondary">{current} / {total}</span>
        <span className="text-text-primary tabular-nums font-mono">{percent}%</span>
      </div>
      <div className="w-full bg-[#1A1A28] rounded-full h-2 overflow-hidden">
        <motion.div
          className="relative h-full rounded-full bg-gradient-to-r from-accent to-cyan-400 shadow-[0_0_12px_rgba(16,224,160,0.3)]"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {animate && percent < 100 && (
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
