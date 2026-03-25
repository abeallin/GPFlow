'use client';

import { useState, useEffect } from 'react';
import { FileText, RotateCw } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
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
  const [loading, setLoading] = useState(true);

  const loadRuns = async () => {
    setLoading(true);
    if (ipc) {
      const data = await ipc.getRuns(50, 0);
      setRuns(data);
    }
    setLoading(false);
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl bg-bg-raised" />)}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No runs yet"
        description="Start a template operation to see your run history here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Card key={run.id} variant="elevated" className="p-4 bg-bg-raised border border-border-subtle hover:border-border transition-colors duration-200">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-text-primary">Run #{run.id}</span>
                <Badge variant={statusVariant(run.status)} dot>{run.status}</Badge>
                <Badge>{run.type}</Badge>
              </div>
              <p className="text-xs text-text-muted">
                {new Date(run.started_at).toLocaleString()} — {run.success_count} ok, {run.fail_count} failed
              </p>
            </div>
            {run.fail_count > 0 && run.status !== 'running' && (
              <Button variant="secondary" size="sm" icon={<RotateCw className="w-3.5 h-3.5" />} onClick={async () => {
                if (!ipc) return;
                const { practiceIds } = await ipc.retryFailed(run.id);
                sessionStorage.setItem('selectedPracticeIds', JSON.stringify(practiceIds));
              }}>
                Retry
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
