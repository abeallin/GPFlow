'use client';

import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { ProgressFeed } from '@/components/ProgressFeed';
import { RunHistory } from '@/components/RunHistory';
import { useAutomationProgress } from '@/hooks/useAutomationProgress';
import { ipc } from '@/lib/ipc-client';

export default function RunsPage() {
  const { events, summary, requires2fa } = useAutomationProgress();
  const total = events.length > 0 ? events[events.length - 1].total : 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Run Dashboard</h1>

      {requires2fa && (
        <Card className="p-4 border-warning bg-yellow-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-yellow-800">
              Two-factor authentication required. Complete 2FA in the browser window.
            </p>
            <Button size="sm" onClick={() => ipc?.continuePast2fa(0)}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {summary && (
        <Card className="p-6 bg-green-50 border-success">
          <h2 className="font-bold text-lg text-green-800">Run Complete</h2>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Total:</span> {summary.totalCount}</div>
            <div><span className="text-gray-500">Success:</span> {summary.successCount}</div>
            <div><span className="text-gray-500">Failed:</span> {summary.failCount}</div>
          </div>
        </Card>
      )}

      <Tabs tabs={[
        {
          id: 'live',
          label: 'Live Progress',
          content: (
            <Card className="p-4">
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
