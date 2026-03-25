'use client';

import { useState, useEffect } from 'react';
import { ipc } from '@/lib/ipc-client';

export interface ProgressEvent {
  runId: number;
  step: number;
  total: number;
  practice: string;
  status: 'success' | 'failed' | 'skipped';
  screenshotPath?: string;
  timestamp: string;
}

export interface RunSummary {
  runId: number;
  totalCount: number;
  successCount: number;
  failCount: number;
  duration: number;
}

export function useAutomationProgress() {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [requires2fa, setRequires2fa] = useState(false);

  useEffect(() => {
    if (!ipc) return;

    ipc.onProgress((event: ProgressEvent) => {
      setEvents((prev) => [...prev, event]);
    });

    ipc.onRunComplete((event: { summary: RunSummary }) => {
      setSummary(event.summary);
    });

    ipc.on2faRequired(() => {
      setRequires2fa(true);
    });

    return () => {
      ipc?.removeAllListeners('automation:progress');
      ipc?.removeAllListeners('automation:complete');
      ipc?.removeAllListeners('automation:2fa-required');
    };
  }, []);

  const reset = () => {
    setEvents([]);
    setSummary(null);
    setRequires2fa(false);
  };

  return { events, summary, requires2fa, reset };
}
