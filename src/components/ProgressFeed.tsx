'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, SkipForward, Play } from 'lucide-react';
import { ProgressBar } from './ui/ProgressBar';
import { EmptyState } from './ui/EmptyState';
import type { ProgressEvent } from '@/lib/ipc-client';
import type { RunProgress } from '@/hooks/useAutomationProgress';

interface ProgressFeedProps {
  events: ProgressEvent[];
  /** One entry per run; each gets its own bar so counts never mix across runs. */
  progress: RunProgress[];
}

const statusConfig = {
  success: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-l-success' },
  failed: { icon: XCircle, color: 'text-error', bg: 'bg-error/10', border: 'border-l-error' },
  skipped: { icon: SkipForward, color: 'text-warning', bg: 'bg-warning/10', border: 'border-l-warning' },
};

export function ProgressFeed({ events, progress }: ProgressFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0 && progress.length === 0) {
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
      <div className="space-y-3">
        {progress.map((run) => (
          <div key={run.runId} data-testid={`run-progress-${run.runId}`} className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="font-mono">Run #{run.runId}</span>
              {run.accountLabel && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
                  {run.accountLabel}
                </span>
              )}
            </div>
            <ProgressBar current={run.done} total={run.total} animate={run.done < run.total} />
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="max-h-96 overflow-y-auto space-y-2 pr-1">
        <AnimatePresence initial={false}>
          {events.map((event, i) => {
            const { icon: Icon, color, bg, border } = statusConfig[event.status] ?? statusConfig.skipped;
            return (
              <motion.div
                key={`${event.runId}-${event.step}-${i}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${border} ${bg} backdrop-blur-sm text-sm`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 ${color} shrink-0`} />
                  {event.accountLabel && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
                      {event.accountLabel}
                    </span>
                  )}
                  <span className="font-medium text-text-primary truncate">{event.practice}</span>
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
