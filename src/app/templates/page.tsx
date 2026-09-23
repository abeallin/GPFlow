'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
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
import { useRouter } from 'next/navigation';

interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

type ScreenshotMode = StartRunConfig['screenshotMode'];

export default function TemplatesPage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [practices, setPractices] = useState<PracticeLike[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode>('on-failure');
  const [webError, setWebError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startFailures, setStartFailures] = useState<{ accountLabel: string; reason: string }[]>([]);
  const [starting, setStarting] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
    setSelectedIds(readJson<number[]>(sessionStorage, 'selectedPracticeIds', [], isNumberArray));
    setAssignments(readJson<Assignments>(localStorage, 'gpflow_assignments', {}, isStringRecord));
    setPractices(readJson<PracticeLike[]>(localStorage, 'gpflow_practices', [], isArray));
    setAccounts(getAccounts());
  }, []);

  // Group selected practices by account (assignments keyed by `${source_file}::${accurx_id}`)
  const groupedByAccount = useMemo(
    () => groupSelectedByAccount(selectedIds, practices, assignments, accounts),
    [selectedIds, assignments, practices, accounts],
  );

  // Detect cross-account duplicates (same accurx_id assigned to multiple accounts)
  const duplicates = useMemo(() => {
    const labelOf = (id: string) => accounts.find((a) => a.id === id)?.label || id;
    return findCrossAccountDuplicates(selectedIds, practices, assignments).map((d) => ({
      accurxId: d.accurxId,
      name: d.name,
      accountLabels: [...new Set(d.entries.map((e) => e.accountId))].map(labelOf),
    }));
  }, [practices, selectedIds, assignments, accounts]);

  const startRun = async (config: TemplateConfig, type: 'create' | 'delete') => {
    if (starting) return;
    setStartError(null);
    setStartFailures([]);

    if (!ipc) {
      setWebError('Automation requires the GP Flow desktop app. The web version is for data management only.');
      return;
    }
    setWebError(null);

    const accountEntries = Object.values(groupedByAccount.groups);
    if (accountEntries.length === 0) {
      setStartError('No assigned practices selected. Go back to the Data page and assign each file to an account first.');
      return;
    }

    setStarting(true);
    try {
      // Resolve every credential first so a missing password aborts before any run starts.
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
        setStartError(
          `No stored password for ${missingPasswords.join(', ')}. Re-add the account on the login page before starting a run.`,
        );
        return;
      }

      // Start every account's run concurrently; each resolves as soon as it is registered.
      const api = ipc;
      const results = await Promise.allSettled(configs.map((c) => api.startRun(c)));

      const failures: { accountLabel: string; reason: string }[] = [];
      let anySuccess = false;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          anySuccess = true;
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          failures.push({ accountLabel: configs[i].accountLabel ?? '', reason });
        }
      });

      setStartFailures(failures);
      if (anySuccess) router.push('/runs');
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
          Template Management
        </h1>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-sm text-text-muted">
            {selectedIds.length} practices selected
          </span>
          {Object.values(groupedByAccount.groups).map(({ account, practices: runPractices }) => (
            <span
              key={account.id}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent/10 text-accent border border-accent/20"
            >
              {account.label}: {runPractices.length}
            </span>
          ))}
          {groupedByAccount.unassigned.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/10 text-warning border border-warning/20">
              Unassigned: {groupedByAccount.unassigned.length}
            </span>
          )}
        </div>
      </motion.div>

      {/* Duplicate warning */}
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
                <p className="text-xs text-text-muted">...and {duplicates.length - 10} more</p>
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* Web mode warning */}
      {webError && (
        <Alert variant="warning" title="Desktop App Required" onDismiss={() => setWebError(null)}>
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
          <ul className="space-y-1 mt-1">
            {startFailures.map((f, i) => (
              <li key={`${f.accountLabel}-${i}`} className="text-xs">
                <span className="font-medium text-text-primary">{f.accountLabel || 'Account'}:</span> {f.reason}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {!isElectron && (
        <div className="glass-card rounded-xl px-4 py-3 text-xs text-text-muted flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
          Running in web mode — automation will only work in the GP Flow desktop app.
        </div>
      )}

      {/* Tabs Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <div className="glass-card rounded-2xl p-6">
          <Tabs tabs={[
            {
              id: 'create',
              label: 'Create Template',
              content: <TemplateForm mode="create" onSubmit={(c) => startRun(c, 'create')} practiceCount={selectedIds.length} busy={starting} />,
            },
            {
              id: 'delete',
              label: 'Delete Template',
              content: <TemplateForm mode="delete" onSubmit={(c) => startRun(c, 'delete')} practiceCount={selectedIds.length} busy={starting} />,
            },
          ]} />
        </div>
      </motion.div>

      {/* Screenshot Mode */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <div className="glass-card rounded-2xl p-5">
          <Select
            label="Screenshot Mode"
            value={screenshotMode}
            onChange={(e) => setScreenshotMode(e.target.value as ScreenshotMode)}
          >
            <option value="off">Off</option>
            <option value="on-failure">On failure only</option>
            <option value="every-step">Every step</option>
          </Select>
        </div>
      </motion.div>
    </div>
  );
}
