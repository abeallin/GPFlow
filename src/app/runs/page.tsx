'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, TrendingUp, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
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
  const { events, summary, requires2fa } = useAutomationProgress();
  const [runs, setRuns] = useState<any[]>([]);
  const total = events.length > 0 ? events[events.length - 1].total : 0;

  useEffect(() => {
    if (ipc) ipc.getRuns(50, 0).then(setRuns);
  }, [summary]);

  const successRate = runs.length > 0
    ? Math.round((runs.filter((r: any) => r.status === 'completed').length / runs.length) * 100)
    : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
          Run Dashboard
        </h1>
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

      {/* Alerts */}
      <AnimatePresence>
        {requires2fa && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Alert variant="warning" title="Two-Factor Authentication Required">
              <div className="flex items-center justify-between">
                <span>Complete 2FA in the browser window to continue.</span>
                <Button size="sm" onClick={() => ipc?.continuePast2fa(0)}>Continue</Button>
              </div>
            </Alert>
          </motion.div>
        )}

        {summary && (
          <motion.div
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
                <ProgressFeed events={events} total={total} />
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
