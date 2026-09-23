'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ipc,
  type ActiveRun,
  type ProgressEvent,
  type RunCompleteEvent,
  type RunErrorEvent,
  type RunSummary,
  type TwoFactorEvent,
} from '@/lib/ipc-client';

export type { ProgressEvent, RunSummary };

export interface RunProgress {
  runId: number;
  accountLabel: string;
  done: number;
  total: number;
}

function upsertActive(list: ActiveRun[], run: ActiveRun): ActiveRun[] {
  const idx = list.findIndex((r) => r.runId === run.runId);
  if (idx === -1) return [...list, run];
  if (list[idx].accountLabel === run.accountLabel || !run.accountLabel) return list;
  const next = list.slice();
  next[idx] = run;
  return next;
}

function withoutRun<T extends { runId: number }>(list: T[], runId: number): T[] {
  return list.filter((r) => r.runId !== runId);
}

export function useAutomationProgress() {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [completed, setCompleted] = useState<RunCompleteEvent[]>([]);
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([]);
  const [twoFactorRunIds, setTwoFactorRunIds] = useState<number[]>([]);
  const [progressByRun, setProgressByRun] = useState<Record<number, RunProgress>>({});
  const [errors, setErrors] = useState<RunErrorEvent[]>([]);

  useEffect(() => {
    if (!ipc) return;
    let cancelled = false;

    ipc.getActiveRuns()
      .then((runs) => {
        if (cancelled || !Array.isArray(runs)) return;
        setActiveRuns((prev) => runs.reduce(upsertActive, prev));
      })
      .catch(() => { /* main process unavailable — start with no active runs */ });

    ipc.onProgress((event: ProgressEvent) => {
      setEvents((prev) => [...prev, event]);
      setActiveRuns((prev) => upsertActive(prev, { runId: event.runId, accountLabel: event.accountLabel ?? '' }));
      setTwoFactorRunIds((prev) => prev.filter((id) => id !== event.runId));
      setProgressByRun((prev) => ({
        ...prev,
        [event.runId]: {
          runId: event.runId,
          accountLabel: event.accountLabel ?? prev[event.runId]?.accountLabel ?? '',
          done: event.step,
          total: event.total,
        },
      }));
    });

    ipc.on2faRequired((event: TwoFactorEvent) => {
      setActiveRuns((prev) => upsertActive(prev, { runId: event.runId, accountLabel: event.accountLabel }));
      setTwoFactorRunIds((prev) => (prev.includes(event.runId) ? prev : [...prev, event.runId]));
    });

    ipc.onRunComplete((event: RunCompleteEvent) => {
      setSummary(event.summary);
      setCompleted((prev) => [...withoutRun(prev, event.runId), event]);
      setActiveRuns((prev) => withoutRun(prev, event.runId));
      setTwoFactorRunIds((prev) => prev.filter((id) => id !== event.runId));
      setProgressByRun((prev) => {
        const current = prev[event.runId];
        if (!current) return prev;
        return { ...prev, [event.runId]: { ...current, done: current.total } };
      });
    });

    ipc.onRunError((event: RunErrorEvent) => {
      setErrors((prev) => [...prev, event]);
      setActiveRuns((prev) => withoutRun(prev, event.runId));
      setTwoFactorRunIds((prev) => prev.filter((id) => id !== event.runId));
    });

    return () => {
      cancelled = true;
      ipc?.removeAllListeners('automation:progress');
      ipc?.removeAllListeners('automation:complete');
      ipc?.removeAllListeners('automation:2fa-required');
      ipc?.removeAllListeners('automation:error');
    };
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setSummary(null);
    setCompleted([]);
    setTwoFactorRunIds([]);
    setProgressByRun({});
    setErrors([]);
  }, []);

  const dismissError = useCallback((index: number) => {
    setErrors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const runProgress: RunProgress[] = Object.values(progressByRun).sort((a, b) => a.runId - b.runId);

  return {
    events,
    summary,
    completed,
    activeRuns,
    twoFactorRunIds,
    runProgress,
    errors,
    reset,
    dismissError,
  };
}
