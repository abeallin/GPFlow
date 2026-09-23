'use client';

import { useRef, useEffect } from 'react';
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

// Every status carries its word beside the icon (docs/ui-rules.md §2).
const statusConfig = {
  success: { icon: CheckCircle, color: 'text-accent', border: 'border-l-accent', word: 'Done' },
  failed: { icon: XCircle, color: 'text-error-text', border: 'border-l-error', word: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-warning', border: 'border-l-warning', word: 'Skipped' },
};

export function ProgressFeed({ events, progress }: ProgressFeedProps) {
  const scrollRef = useRef<HTMLOListElement>(null);

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
        description="Live progress for runs started from the Templates page will appear here, one line per practice."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {progress.map((run) => (
          <div key={run.runId} data-testid={`run-progress-${run.runId}`} className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="font-mono">Run #{run.runId}</span>
              {run.accountLabel && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                  {run.accountLabel}
                </span>
              )}
            </div>
            <ProgressBar current={run.done} total={run.total} animate={run.done < run.total} label={`Run ${run.runId} progress`} />
          </div>
        ))}
      </div>
      <ol ref={scrollRef} aria-label="Progress log" className="max-h-96 overflow-y-auto space-y-2 pr-1 list-none m-0 p-0">
        {events.map((event, i) => {
          const { icon: Icon, color, border, word } = statusConfig[event.status] ?? statusConfig.skipped;
          return (
            <li
              key={`${event.runId}-${event.step}-${i}`}
              className={`flex items-center justify-between p-3 rounded-lg border border-border border-l-4 ${border} bg-bg-root text-sm`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 ${color} shrink-0`} aria-hidden="true" />
                <span className={`text-xs font-medium w-14 shrink-0 ${color}`}>{word}</span>
                {event.accountLabel && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    {event.accountLabel}
                  </span>
                )}
                <span className="font-medium text-text-primary truncate">{event.practice}</span>
                {event.status === 'failed' && event.error && (
                  <span className="text-xs text-text-secondary truncate">{event.error}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-text-secondary text-xs tabular-nums">
                <span>{event.step}/{event.total}</span>
                <span>{new Date(event.timestamp).toLocaleTimeString('en-GB')}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
