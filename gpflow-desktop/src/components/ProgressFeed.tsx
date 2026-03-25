'use client';

import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';

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

export function ProgressFeed({ events, total }: ProgressFeedProps) {
  const current = events.length;

  return (
    <div className="space-y-4">
      <ProgressBar current={current} total={total} />
      <div className="max-h-96 overflow-y-auto space-y-2">
        {[...events].reverse().map((event, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center gap-3">
              <Badge variant={event.status === 'success' ? 'success' : event.status === 'failed' ? 'error' : 'warning'}>
                {event.status}
              </Badge>
              <span className="font-medium">{event.practice}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <span>{event.step}/{event.total}</span>
              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
