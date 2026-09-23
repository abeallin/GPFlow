'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, RotateCw } from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { LoadError } from './ui/LoadError';
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

// Status → word + tone. Only failure gets an urgent colour (docs/ui-rules.md §2).
const STATUS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  running: { label: 'Running', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

export function RunHistory() {
  // null = unknown (not loaded or failed); [] = genuinely none.
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const router = useRouter();

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (ipc) {
        const data = await ipc.getRuns(50, 0);
        setRuns(Array.isArray(data) ? data : []);
      } else {
        setRuns([]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load run history');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = async (runId: number) => {
    if (!ipc) return;
    setActionError(null);
    setRetryingId(runId);
    try {
      const { practiceIds } = await ipc.retryFailed(runId);
      sessionStorage.setItem('selectedPracticeIds', JSON.stringify(practiceIds));
      router.push('/templates');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to prepare retry');
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  if (loadError || runs === null) {
    return <LoadError title="Couldn't load run history" message={`${loadError ?? 'Unknown error.'} Nothing has changed.`} onRetry={() => { void loadRuns(); }} />;
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No runs yet"
        description="Each bulk create or delete you start from the Templates page will be listed here with its outcome."
      />
    );
  }

  return (
    <div className="space-y-3">
      {actionError && <Alert variant="error" title="Could not prepare retry" onDismiss={() => setActionError(null)}>{actionError}</Alert>}
      <ul className="space-y-3 list-none m-0 p-0">
        {runs.map((run) => {
          const status = STATUS[run.status] ?? { label: run.status, variant: 'default' as const };
          return (
            <li key={run.id} className="rounded-xl border border-border bg-bg-raised p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-text-primary">Run #{run.id}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Badge>{run.type === 'delete' ? 'Delete' : 'Create'}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary tabular-nums">
                    {new Date(run.started_at).toLocaleString('en-GB')} · {run.success_count} succeeded, {run.fail_count} failed
                  </p>
                </div>
                {run.fail_count > 0 && run.status !== 'running' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RotateCw className="w-3.5 h-3.5" aria-hidden="true" />}
                    pending={retryingId === run.id}
                    pendingLabel="Preparing…"
                    onClick={() => handleRetry(run.id)}
                    aria-label={`Retry failed practices from run ${run.id}`}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
