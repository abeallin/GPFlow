'use client';

import { useState, useEffect } from 'react';
import { FileText, RotateCw } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { Alert } from './ui/Alert';
import { ipc } from '@/lib/ipc-client';
import { useRouter } from 'next/navigation';

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
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const router = useRouter();

  const loadRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      if (ipc) {
        const data = await ipc.getRuns(50, 0);
        setRuns(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run history');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (runId: number) => {
    if (!ipc) return;
    setError(null);
    setRetryingId(runId);
    try {
      const { practiceIds } = await ipc.retryFailed(runId);
      sessionStorage.setItem('selectedPracticeIds', JSON.stringify(practiceIds));
      router.push('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare retry');
    } finally {
      setRetryingId(null);
    }
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
      <div className="space-y-3">
        {error && <Alert variant="error" title="Run history unavailable" onDismiss={() => setError(null)}>{error}</Alert>}
        <EmptyState
          icon={<FileText />}
          title="No runs yet"
          description="Start a template operation to see your run history here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error" title="Something went wrong" onDismiss={() => setError(null)}>{error}</Alert>}
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
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCw className="w-3.5 h-3.5" />}
                loading={retryingId === run.id}
                onClick={() => handleRetry(run.id)}
              >
                Retry
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
