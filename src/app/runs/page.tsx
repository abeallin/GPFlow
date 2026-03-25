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
      <h1 className="text-2xl font-bold text-text-primary">Run Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Runs" value={runs.length} icon={<Play />} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={<TrendingUp />} />
        <StatCard label="Last Run" value={runs[0] ? new Date(runs[0].started_at).toLocaleDateString() : 'Never'} icon={<Clock />} />
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {requires2fa && (
          <Alert variant="warning" title="Two-Factor Authentication Required">
            <div className="flex items-center justify-between">
              <span>Complete 2FA in the browser window to continue.</span>
              <Button size="sm" onClick={() => ipc?.continuePast2fa(0)}>Continue</Button>
            </div>
          </Alert>
        )}

        {summary && (
          <Alert variant="success" title="Run Complete">
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div><span className="text-text-muted">Total:</span> {summary.totalCount}</div>
              <div><span className="text-text-muted">Success:</span> {summary.successCount}</div>
              <div><span className="text-text-muted">Failed:</span> {summary.failCount}</div>
            </div>
          </Alert>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <Tabs tabs={[
        {
          id: 'live',
          label: 'Live Progress',
          content: (
            <Card className="p-5">
              <ProgressFeed events={events} total={total} />
            </Card>
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
