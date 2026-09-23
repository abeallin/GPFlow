'use client';

import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { TemplateForm } from '@/components/TemplateForm';
import { ipc, type StartRunConfig } from '@/lib/ipc-client';
import { getAccounts, getPasswordAsync, type Account } from '@/lib/accounts';
import {
  groupSelectedByAccount,
  findCrossAccountDuplicates,
  type Assignments,
  type PracticeLike,
} from '@/lib/assignments';
import { readJson, isArray, isStringRecord, isNumberArray } from '@/lib/storage';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRouter } from 'next/navigation';

interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

type ScreenshotMode = StartRunConfig['screenshotMode'];
type RunType = 'create' | 'delete';

export default function TemplatesPage() {
  usePageTitle('Templates');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [practices, setPractices] = useState<PracticeLike[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode>('on-failure');
  const [webError, setWebError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startFailures, setStartFailures] = useState<{ accountLabel: string; reason: string }[]>([]);
  const [starting, setStarting] = useState(false);
  const [pendingRun, setPendingRun] = useState<{ config: TemplateConfig; type: RunType } | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
    setSelectedIds(readJson<number[]>(sessionStorage, 'selectedPracticeIds', [], isNumberArray));
    setAssignments(readJson<Assignments>(localStorage, 'gpflow_assignments', {}, isStringRecord));
    setPractices(readJson<PracticeLike[]>(localStorage, 'gpflow_practices', [], isArray));
    setAccounts(getAccounts());
  }, []);

  const groupedByAccount = useMemo(
    () => groupSelectedByAccount(selectedIds, practices, assignments, accounts),
    [selectedIds, assignments, practices, accounts],
  );

  const duplicates = useMemo(() => {
    const labelOf = (id: string) => accounts.find((a) => a.id === id)?.label || id;
    return findCrossAccountDuplicates(selectedIds, practices, assignments).map((d) => ({
      accurxId: d.accurxId,
      name: d.name,
      accountLabels: [...new Set(d.entries.map((e) => e.accountId))].map(labelOf),
    }));
  }, [practices, selectedIds, assignments, accounts]);

  const accountEntries = Object.values(groupedByAccount.groups);
  const assignedCount = accountEntries.reduce((n, e) => n + e.practices.length, 0);

  /** Validate, then ask. The run itself starts from the dialog's confirm. */
  const requestRun = (config: TemplateConfig, type: RunType) => {
    if (starting) return;
    setStartError(null);
    setStartFailures([]);

    if (!ipc) {
      setWebError('Automation requires the GP Flow desktop app. The web version is for data management only.');
      return;
    }
    setWebError(null);

    if (accountEntries.length === 0) {
      setStartError('No assigned practices selected. Go back to the Data page and assign each file to an account first.');
      return;
    }
    setPendingRun({ config, type });
  };

  const startRun = async ({ config, type }: { config: TemplateConfig; type: RunType }) => {
    const api = ipc;
    if (!api) return;
    setStarting(true);
    try {
      const configs: StartRunConfig[] = [];
      const missingPasswords: string[] = [];
      for (const { account, practices: runPractices } of accountEntries) {
        const password = await getPasswordAsync(account.id);
        if (!password) {
          missingPasswords.push(account.label);
          continue;
        }
        configs.push({
          type,
          templateConfig: config,
          practices: runPractices,
          screenshotMode,
          credentials: { username: account.username, password },
          accountLabel: account.label,
        });
      }

      if (missingPasswords.length > 0) {
        throw new Error(
          `No stored password for ${missingPasswords.join(', ')}. Re-add the account on the login page before starting a run.`,
        );
      }

      const results = await Promise.allSettled(configs.map((c) => api.startRun(c)));

      const failures: { accountLabel: string; reason: string }[] = [];
      let started = 0;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          started++;
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          failures.push({ accountLabel: configs[i].accountLabel ?? '', reason });
        }
      });

      if (started === 0) {
        const detail = failures.map((f) => `${f.accountLabel}: ${f.reason}`).join('; ');
        throw new Error(`No run could start. ${detail}`);
      }

      setStartFailures(failures);
      setPendingRun(null);
      toast({
        tone: failures.length ? 'info' : 'success',
        title: `${started} run${started === 1 ? '' : 's'} started`,
        message: `${type === 'create' ? 'Creating' : 'Deleting'} '${config.template_name}' on ${assignedCount} practices`,
      });
      router.push('/runs');
    } finally {
      setStarting(false);
    }
  };

  const verb = pendingRun?.type === 'delete' ? 'Delete' : 'Create';

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
          Template Management
        </h1>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-sm text-text-secondary">
            {selectedIds.length} practices selected
          </span>
          {accountEntries.map(({ account, practices: runPractices }) => (
            <span
              key={account.id}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-accent/10 text-accent border border-accent/20"
            >
              {account.label}: {runPractices.length}
            </span>
          ))}
          {groupedByAccount.unassigned.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-warning/10 text-warning border border-warning/20">
              Unassigned: {groupedByAccount.unassigned.length}
            </span>
          )}
        </div>
      </div>

      {duplicates.length > 0 && (
        <Alert variant="warning" title={`${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} across accounts`}>
          <div className="space-y-1.5 mt-1">
            <p className="text-xs text-text-secondary">
              These practices are assigned to multiple accounts and will be processed once per account.
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {duplicates.slice(0, 10).map((d) => (
                <div key={d.accurxId} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-text-muted">{d.accurxId}</span>
                  <span className="text-text-primary truncate">{d.name}</span>
                  <span className="text-text-muted">→ {d.accountLabels.join(', ')}</span>
                </div>
              ))}
              {duplicates.length > 10 && (
                <p className="text-xs text-text-muted">and {duplicates.length - 10} more</p>
              )}
            </div>
          </div>
        </Alert>
      )}

      {webError && (
        <Alert variant="warning" title="Desktop app required" onDismiss={() => setWebError(null)}>
          {webError}
        </Alert>
      )}

      {startError && (
        <Alert variant="error" title="Cannot start run" onDismiss={() => setStartError(null)}>
          {startError}
        </Alert>
      )}

      {startFailures.length > 0 && (
        <Alert
          variant="error"
          title={`${startFailures.length} account${startFailures.length > 1 ? 's' : ''} failed to start`}
          onDismiss={() => setStartFailures([])}
        >
          <ul className="space-y-1 mt-1 list-none m-0 p-0">
            {startFailures.map((f, i) => (
              <li key={`${f.accountLabel}-${i}`} className="text-xs">
                <span className="font-medium text-text-primary">{f.accountLabel || 'Account'}:</span> {f.reason}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {!isElectron && (
        <div className="rounded-xl border border-border bg-bg-raised px-4 py-3 text-xs text-text-secondary flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
          Running in web mode — automation will only work in the GP Flow desktop app.
        </div>
      )}

      <div className="rounded-xl border border-border bg-bg-raised p-6">
        <Tabs tabs={[
          {
            id: 'create',
            label: 'Create Template',
            content: <TemplateForm mode="create" onSubmit={(c) => requestRun(c, 'create')} practiceCount={assignedCount} busy={starting} />,
          },
          {
            id: 'delete',
            label: 'Delete Template',
            content: <TemplateForm mode="delete" onSubmit={(c) => requestRun(c, 'delete')} practiceCount={assignedCount} busy={starting} />,
          },
        ]} />
      </div>

      <div className="rounded-xl border border-border bg-bg-raised p-5">
        <Select
          label="Screenshot mode"
          hint="Screenshots are saved per run in the app data folder."
          value={screenshotMode}
          onChange={(e) => setScreenshotMode(e.target.value as ScreenshotMode)}
        >
          <option value="off">Off</option>
          <option value="on-failure">On failure only</option>
          <option value="every-step">Every step</option>
        </Select>
      </div>

      {pendingRun && (
        <ConfirmDialog
          title={`${verb} '${pendingRun.config.template_name}' ${pendingRun.type === 'delete' ? 'from' : 'on'} ${assignedCount} practice${assignedCount === 1 ? '' : 's'}?`}
          body={
            <>
              <p>
                One browser per account will log in to Accurx and {pendingRun.type === 'delete' ? 'delete' : 'create'} the template on every selected practice
                ({accountEntries.map((e) => `${e.account.label}: ${e.practices.length}`).join(', ')}).
              </p>
              {pendingRun.type === 'delete' && (
                <p className="mt-2">Only templates whose name matches exactly are removed. This cannot be undone.</p>
              )}
            </>
          }
          confirmLabel={`${verb} on ${assignedCount} practice${assignedCount === 1 ? '' : 's'}`}
          pendingLabel="Starting…"
          tone={pendingRun.type === 'delete' ? 'destructive' : 'default'}
          safeMessage="No runs were started."
          onCancel={() => setPendingRun(null)}
          onConfirm={() => startRun(pendingRun)}
        />
      )}
    </div>
  );
}
