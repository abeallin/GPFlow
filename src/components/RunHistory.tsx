'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ipc } from '@/lib/ipc-client';

interface Run {
  id: number;
  started_at: string;
  type: string;
  success_count: number;
  fail_count: number;
  status: string;
}

export function RunHistory() {
  const [runs, setRuns] = useState<Run[]>([]);

  const loadRuns = async () => {
    if (!ipc) return;
    const data = await ipc.getRuns(50, 0);
    setRuns(data);
  };

  useEffect(() => { loadRuns(); }, []);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success' as const;
      case 'failed': return 'error' as const;
      case 'running': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-3">
      {runs.length === 0 && <p className="text-sm text-gray-500">No runs yet</p>}
      {runs.map((run) => (
        <Card key={run.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Run #{run.id}</span>
                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                <Badge>{run.type}</Badge>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(run.started_at).toLocaleString()} - {run.success_count} ok, {run.fail_count} failed
              </p>
            </div>
            {run.fail_count > 0 && run.status !== 'running' && (
              <Button variant="secondary" size="sm" onClick={async () => {
                if (!ipc) return;
                const { practiceIds } = await ipc.retryFailed(run.id);
                sessionStorage.setItem('selectedPracticeIds', JSON.stringify(practiceIds));
              }}>
                Retry Failed
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
