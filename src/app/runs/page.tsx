'use client';

import { useState, useEffect } from 'react';
import { Play, TrendingUp, Clock, Square, OctagonX } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { toast } from '@/components/ui/Toast';
import { ProgressFeed } from '@/components/ProgressFeed';
import { RunHistory } from '@/components/RunHistory';
import { useAutomationProgress } from '@/hooks/useAutomationProgress';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ipc } from '@/lib/ipc-client';
import type { Run } from '@/lib/types';

export default function RunsPage() {
  usePageTitle('Runs');
  const { events, summary, completed, activeRuns, twoFactorRunIds, runProgress, errors, dismissError } = useAutomationProgress();
  // null = unknown (not loaded, or failed): stat tiles show a dash, never 0.
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<Set<number | 'all'>>(new Set());
  const [stopError, setStopError] = useState<string | null>(null);

  useEffect(() => {
    if (!ipc) return;
    let cancelled = false;
    ipc.getRuns(50, 0)
      .then((data) => { if (!cancelled) setRuns(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'Failed to load runs'); });
    return () => { cancelled = true; };
  }, [summary]);

  // Every outcome is toasted and announced (docs/ui-rules.md §7).
  useEffect(() => {
    const last = completed[completed.length - 1];
    if (!last) return;
    const { summary: s } = last;
    toast({
      tone: s.failCount > 0 ? 'info' : 'success',
      title: `Run for ${last.accountLabel || `#${last.runId}`} finished`,
      message: `${s.successCount} succeeded, ${s.failCount} failed of ${s.totalCount}`,
    });
  }, [completed]);

  useEffect(() => {
    const last = errors[errors.length - 1];
    if (!last) return;
    toast({ tone: 'error', title: `Run for ${last.accountLabel || `#${last.runId}`} failed`, message: last.error });
  }, [errors]);

  const markStopping = (key: number | 'all', on: boolean) => {
    setStopping((prev) => {
      const next = new Set(prev);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  };

  const handleStop = async (runId: number) => {
    if (!ipc) return;
    setStopError(null);
    markStopping(runId, true);
    try {
      await ipc.stopRun(runId);
    } catch (err) {
      setStopError(err instanceof Error ? err.message : `Failed to stop run #${runId}`);
    } finally {
      markStopping(runId, false);
    }
  };

  const handleStopAll = async () => {
    if (!ipc) return;
    setStopError(null);
    markStopping('all', true);
    try {
      await ipc.stopAllRuns();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : 'Failed to stop runs');
    } finally {
      markStopping('all', false);
    }
  };

  const successRate = runs && runs.length > 0
    ? `${Math.round((runs.filter((r) => r.status === 'completed').length / runs.length) * 100)}%`
    : runs ? '0%' : null;
  const lastRun = runs ? (runs[0] ? new Date(runs[0].started_at).toLocaleDateString('en-GB') : 'No runs yet') : null;

  const twoFactorLabels = twoFactorRunIds.map((id) => activeRuns.find((r) => r.runId === id)?.accountLabel || `run #${id}`);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
          Run Dashboard
        </h1>
        {activeRuns.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<OctagonX className="w-4 h-4" aria-hidden="true" />}
            pending={stopping.has('all')}
            pendingLabel="Stopping…"
            onClick={handleStopAll}
          >
            Stop all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total runs" value={runs ? runs.length : null} icon={<Play />} />
        <StatCard label="Success rate" value={successRate} icon={<TrendingUp />} />
        <StatCard label="Last run" value={lastRun} icon={<Clock />} />
      </div>

      {activeRuns.length > 0 && (
        <section aria-labelledby="active-heading" className="rounded-xl border border-border bg-bg-raised p-4 space-y-2">
          <h2 id="active-heading" className="text-xs font-semibold text-text-secondary font-[var(--font-body)] tracking-normal">Active runs</h2>
          <ul className="space-y-2 list-none m-0 p-0">
            {activeRuns.map((run) => (
              <li key={run.runId} className="flex items-center justify-between gap-3 bg-bg-root rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0 text-sm">
                  <span className="font-mono text-xs text-text-secondary">#{run.runId}</span>
                  <span className="text-text-primary truncate">{run.accountLabel || 'Unlabelled account'}</span>
                  {twoFactorRunIds.includes(run.runId) && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                      Waiting for 2FA
                    </span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Stop ${run.accountLabel || `run ${run.runId}`}`}
                  icon={<Square className="w-3.5 h-3.5" aria-hidden="true" />}
                  pending={stopping.has(run.runId)}
                  pendingLabel="Stopping…"
                  onClick={() => handleStop(run.runId)}
                >
                  Stop
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stopError && (
        <Alert variant="error" title="Could not stop run" onDismiss={() => setStopError(null)}>{stopError}</Alert>
      )}

      {historyError && (
        <Alert variant="error" title="Run history unavailable" onDismiss={() => setHistoryError(null)}>{historyError}</Alert>
      )}

      {twoFactorRunIds.length > 0 && (
        <Alert variant="warning" title="Two-factor authentication required">
          Complete 2FA in the browser window for {twoFactorLabels.join(', ')} to continue. Progress resumes automatically.
        </Alert>
      )}

      {errors.map((err, i) => (
        <Alert key={`err-${err.runId}-${i}`} variant="error" title={`Run #${err.runId} failed${err.accountLabel ? ` (${err.accountLabel})` : ''}`} onDismiss={() => dismissError(i)}>
          {err.error}
        </Alert>
      ))}

      {summary && (
        <Alert variant="success" title="Run complete">
          <dl className="grid grid-cols-3 gap-4 mt-2 text-sm tabular-nums m-0">
            <div><dt className="inline text-text-secondary">Total: </dt><dd className="inline">{summary.totalCount}</dd></div>
            <div><dt className="inline text-text-secondary">Succeeded: </dt><dd className="inline text-accent">{summary.successCount}</dd></div>
            <div><dt className="inline text-text-secondary">Failed: </dt><dd className="inline text-error-text">{summary.failCount}</dd></div>
          </dl>
        </Alert>
      )}

      <Tabs tabs={[
        {
          id: 'live',
          label: 'Live Progress',
          content: (
            <div className="rounded-xl border border-border bg-bg-raised p-5">
              <ProgressFeed events={events} progress={runProgress} />
            </div>
          ),
        },
        {
          id: 'history',
          label: 'Run History',
          content: <RunHistory />,
        },
      ]} />
    </div>
  );
}
