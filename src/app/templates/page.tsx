'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
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
import Link from 'next/link';

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
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [retryConfig, setRetryConfig] = useState<(TemplateConfig & { type?: RunType }) | null>(null);
  const autoRetryStartedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const savedIds = readJson<number[]>(sessionStorage, 'selectedPracticeIds', [], isNumberArray);
    const assign = readJson<Assignments>(localStorage, 'gpflow_assignments', {}, isStringRecord);
    const pract = readJson<PracticeLike[]>(localStorage, 'gpflow_practices', [], isArray);
    const accs = getAccounts();

    // When only 1 account exists, auto-assign any unassigned practices seamlessly
    if (accs.length === 1 && pract.length > 0) {
      let changed = false;
      for (const p of pract) {
        const key = `${p.source_file ?? ''}::${p.accurx_id}`;
        if (!assign[key] && !assign[p.accurx_id]) {
          assign[key] = accs[0].id;
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem('gpflow_assignments', JSON.stringify(assign));
      }
    }

    const practIdSet = new Set(pract.map((p) => p.id));
    const validSavedIds = savedIds.filter((id) => practIdSet.has(id));

    if (validSavedIds.length > 0) {
      setSelectedIds(validSavedIds);
    } else if (pract.length > 0) {
      const allIds = pract.map((p) => p.id);
      setSelectedIds(allIds);
      sessionStorage.setItem('selectedPracticeIds', JSON.stringify(allIds));
    } else {
      setSelectedIds([]);
    }

    setAssignments(assign);
    setPractices(pract);
    setAccounts(accs);
    if (accs.length > 0) {
      setTargetAccountId(accs[0].id);
    }

    const retryRaw = sessionStorage.getItem('gpflow_retry_config');
    if (retryRaw) {
      try {
        const parsed = JSON.parse(retryRaw);
        setRetryConfig(parsed);
      } catch {}
    }
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

  useEffect(() => {
    if (autoRetryStartedRef.current) return;
    const autoStart = typeof window !== 'undefined' && sessionStorage.getItem('gpflow_auto_start_retry') === 'true';
    if (autoStart && retryConfig && accountEntries.length > 0 && !starting) {
      autoRetryStartedRef.current = true;
      sessionStorage.removeItem('gpflow_auto_start_retry');
      sessionStorage.removeItem('gpflow_retry_config');
      void startRun({ config: retryConfig, type: retryConfig.type || 'create' });
    }
  }, [retryConfig, accountEntries, starting]);

  const handleAssignUnassigned = () => {
    const accId = targetAccountId || accounts[0]?.id;
    if (!accId) return;
    const practiceMap = new Map(practices.map((p) => [p.id, p]));
    const newAssignments = { ...assignments };
    for (const id of groupedByAccount.unassigned) {
      const p = practiceMap.get(id);
      if (p) {
        const key = `${p.source_file ?? ''}::${p.accurx_id}`;
        newAssignments[key] = accId;
      }
    }
    setAssignments(newAssignments);
    localStorage.setItem('gpflow_assignments', JSON.stringify(newAssignments));
    const targetLabel = accounts.find((a) => a.id === accId)?.label || 'account';
    toast({
      tone: 'success',
      title: 'Practices assigned',
      message: `Assigned ${groupedByAccount.unassigned.length} practice${groupedByAccount.unassigned.length === 1 ? '' : 's'} to ${targetLabel}.`,
    });
  };

  /** Validate, then ask. The run itself starts from the dialog's confirm. */
  const requestRun = (config: TemplateConfig, type: RunType) => {
    if (starting) return;
    setStartError(null);
    setStartFailures([]);
    setWebError(null);

    if (accountEntries.length === 0) {
      setStartError('No assigned practices selected. Assign practices to an account to continue.');
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
          authMethod: account.authMethod ?? 'direct',
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

      {accounts.length === 0 && (
        <Alert variant="warning" title="No Accurx accounts found">
          You need to add an Accurx account before creating templates.{' '}
          <Link href="/accounts" className="font-semibold underline text-accent">Go to Accounts</Link>
        </Alert>
      )}

      {accounts.length > 0 && practices.length === 0 && (
        <Alert variant="warning" title="No practices imported">
          No practice data was found.{' '}
          <Link href="/data" className="font-semibold underline text-accent">Go to Data page to upload a CSV</Link>
        </Alert>
      )}

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



      {groupedByAccount.unassigned.length > 0 && accounts.length > 0 && (
        <section aria-labelledby="unassigned-heading" className="rounded-xl border border-warning/30 bg-bg-raised p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h2 id="unassigned-heading" className="text-sm font-medium text-text-primary font-[var(--font-body)] tracking-normal">
                {groupedByAccount.unassigned.length} selected practice{groupedByAccount.unassigned.length === 1 ? '' : 's'} unassigned
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                To include these practices in the run, assign them to an Accurx account:
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <select
              aria-label="Target account for unassigned practices"
              value={targetAccountId || accounts[0]?.id || ''}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="min-h-9 px-3 rounded-lg border border-border bg-bg-root text-xs text-text-primary"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.username})
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleAssignUnassigned}>
              Assign to {accounts.find((a) => a.id === (targetAccountId || accounts[0]?.id))?.label || 'account'}
            </Button>
          </div>
        </section>
      )}

      <div className="rounded-xl border border-border bg-bg-raised p-6">
        <Tabs
          key={retryConfig?.type || 'create'}
          defaultTab={retryConfig?.type || 'create'}
          tabs={[
            {
              id: 'create',
              label: 'Create Template',
              content: (
                <TemplateForm
                  mode="create"
                  initialConfig={retryConfig?.type !== 'delete' ? (retryConfig ?? undefined) : undefined}
                  onSubmit={(c) => requestRun(c, 'create')}
                  practiceCount={assignedCount}
                  busy={starting}
                />
              ),
            },
            {
              id: 'delete',
              label: 'Delete Template',
              content: (
                <TemplateForm
                  mode="delete"
                  initialConfig={retryConfig?.type === 'delete' ? (retryConfig ?? undefined) : undefined}
                  onSubmit={(c) => requestRun(c, 'delete')}
                  practiceCount={assignedCount}
                  busy={starting}
                />
              ),
            },
          ]}
        />
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
