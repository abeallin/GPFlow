'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, TrendingUp, Clock, Square, OctagonX } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { ProgressFeed } from '@/components/ProgressFeed';
import { RunHistory } from '@/components/RunHistory';
import { useAutomationProgress } from '@/hooks/useAutomationProgress';
import { ipc } from '@/lib/ipc-client';

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

export default function RunsPage() {
  const { events, summary, activeRuns, twoFactorRunIds, runProgress, errors, dismissError } = useAutomationProgress();
  const [runs, setRuns] = useState<any[]>([]);
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

  const successRate = runs.length > 0
    ? Math.round((runs.filter((r: any) => r.status === 'completed').length / runs.length) * 100)
    : 0;

  const twoFactorRuns = activeRuns.filter((r) => twoFactorRunIds.includes(r.runId));
  const twoFactorLabels = twoFactorRunIds.map((id) => activeRuns.find((r) => r.runId === id)?.accountLabel || `run #${id}`);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
          Run Dashboard
        </h1>
        {activeRuns.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            icon={<OctagonX className="w-4 h-4" />}
            loading={stopping.has('all')}
            onClick={handleStopAll}
          >
            Stop all
          </Button>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="grid grid-cols-3 gap-4"
      >
        <motion.div variants={fadeUp}>
          <StatCard label="Total Runs" value={runs.length} icon={<Play />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Success Rate" value={`${successRate}%`} icon={<TrendingUp />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Last Run" value={runs[0] ? new Date(runs[0].started_at).toLocaleDateString() : 'Never'} icon={<Clock />} />
        </motion.div>
      </motion.div>

      {/* Active runs */}
      {activeRuns.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <p className="label">Active runs</p>
          <ul className="space-y-2">
            {activeRuns.map((run) => (
              <li key={run.runId} className="flex items-center justify-between gap-3 bg-bg-root rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0 text-sm">
                  <span className="font-mono text-xs text-text-muted">#{run.runId}</span>
                  <span className="text-text-primary truncate">{run.accountLabel || 'Unlabelled account'}</span>
                  {twoFactorRunIds.includes(run.runId) && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning border border-warning/20">
                      Waiting for 2FA
                    </span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Stop ${run.accountLabel || `run ${run.runId}`}`}
                  icon={<Square className="w-3.5 h-3.5" />}
                  loading={stopping.has(run.runId)}
                  onClick={() => handleStop(run.runId)}
                >
                  Stop
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerts */}
      <AnimatePresence>
        {stopError && (
          <motion.div key="stop-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Alert variant="error" title="Could not stop run" onDismiss={() => setStopError(null)}>{stopError}</Alert>
          </motion.div>
        )}

        {historyError && (
          <motion.div key="history-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Alert variant="error" title="Run history unavailable" onDismiss={() => setHistoryError(null)}>{historyError}</Alert>
          </motion.div>
        )}

        {twoFactorRuns.length > 0 || twoFactorRunIds.length > 0 ? (
          <motion.div
            key="2fa"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Alert variant="warning" title="Two-Factor Authentication Required">
              Complete 2FA in the browser window for {twoFactorLabels.join(', ')} to continue. Progress resumes automatically.
            </Alert>
          </motion.div>
        ) : null}

        {errors.map((err, i) => (
          <motion.div
            key={`err-${err.runId}-${i}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Alert variant="error" title={`Run #${err.runId} failed${err.accountLabel ? ` (${err.accountLabel})` : ''}`} onDismiss={() => dismissError(i)}>
              {err.error}
            </Alert>
          </motion.div>
        ))}

        {summary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Alert variant="success" title="Run Complete">
              <div className="grid grid-cols-3 gap-4 mt-2 font-mono text-sm">
                <div><span className="text-text-muted">Total:</span> {summary.totalCount}</div>
                <div><span className="text-text-muted">Success:</span> <span className="text-accent">{summary.successCount}</span></div>
                <div><span className="text-text-muted">Failed:</span> <span className="text-error">{summary.failCount}</span></div>
              </div>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Tabs tabs={[
          {
            id: 'live',
            label: 'Live Progress',
            content: (
              <div className="glass-card rounded-2xl p-5">
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
      </motion.div>
    </div>
  );
}
