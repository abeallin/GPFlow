'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, SkipForward } from 'lucide-react';
import { ProgressBar } from './ui/ProgressBar';
import { EmptyState } from './ui/EmptyState';
import { Play } from 'lucide-react';

interface ProgressEvent {
  runId: number;
  step: number;
  total: number;
  practice: string;
  status: 'success' | 'failed' | 'skipped';
  screenshotPath?: string;
  timestamp: string;
}

interface ProgressFeedProps {
  events: ProgressEvent[];
  total: number;
}

const statusConfig = {
  success: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-l-success' },
  failed: { icon: XCircle, color: 'text-error', bg: 'bg-error/10', border: 'border-l-error' },
  skipped: { icon: SkipForward, color: 'text-warning', bg: 'bg-warning/10', border: 'border-l-warning' },
};

export function ProgressFeed({ events, total }: ProgressFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Play />}
        title="No active run"
        description="Start a template operation from the Templates page to see live progress here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProgressBar current={events.length} total={total} animate={events.length < total} />
      <div ref={scrollRef} className="max-h-96 overflow-y-auto space-y-2 pr-1">
        <AnimatePresence initial={false}>
          {events.map((event, i) => {
            const { icon: Icon, color, bg, border } = statusConfig[event.status];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${border} ${bg} backdrop-blur-sm text-sm`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="font-medium text-text-primary">{event.practice}</span>
                </div>
                <div className="flex items-center gap-3 text-text-muted text-xs">
                  <span className="tabular-nums">{event.step}/{event.total}</span>
                  <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
