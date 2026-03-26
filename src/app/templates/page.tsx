'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { TemplateForm } from '@/components/TemplateForm';
import { ipc } from '@/lib/ipc-client';
import { getAccounts, getAccountById, type Account } from '@/lib/accounts';
import { useRouter } from 'next/navigation';

interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

export default function TemplatesPage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [screenshotMode, setScreenshotMode] = useState<string>('on-failure');
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem('selectedPracticeIds');
    if (stored) setSelectedIds(JSON.parse(stored));

    const assignStored = sessionStorage.getItem('gpflow_assignments');
    if (assignStored) setAssignments(JSON.parse(assignStored));

    setAccounts(getAccounts());
  }, []);

  // Group selected practices by account
  const groupedByAccount = useMemo(() => {
    const groups: Record<string, { account: Account; practiceIds: number[] }> = {};
    const unassigned: number[] = [];

    for (const id of selectedIds) {
      const accountId = assignments[id];
      if (accountId) {
        if (!groups[accountId]) {
          const account = getAccountById(accountId);
          if (account) groups[accountId] = { account, practiceIds: [] };
        }
        groups[accountId]?.practiceIds.push(id);
      } else {
        unassigned.push(id);
      }
    }
    return { groups, unassigned };
  }, [selectedIds, assignments]);

  const startRun = async (config: TemplateConfig, type: 'create' | 'delete') => {
    if (!ipc) return;

    const { groups } = groupedByAccount;
    const accountEntries = Object.values(groups);

    if (accountEntries.length === 0) {
      // No assignments — run with all selected (legacy behavior)
      const { runId } = await ipc.startRun({
        type,
        templateConfig: config,
        practiceIds: selectedIds,
        screenshotMode,
      });
      router.push(`/runs?active=${runId}`);
      return;
    }

    // Start one run per account
    for (const { account, practiceIds } of accountEntries) {
      await ipc.startRun({
        type,
        templateConfig: config,
        practiceIds,
        screenshotMode,
        credentials: { username: account.username, password: account.password },
      });
    }
    router.push('/runs');
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
          {Object.values(groupedByAccount.groups).map(({ account, practiceIds }) => (
            <span
              key={account.id}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent/10 text-accent border border-accent/20"
            >
              {account.label}: {practiceIds.length}
            </span>
          ))}
          {groupedByAccount.unassigned.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/10 text-warning border border-warning/20">
              Unassigned: {groupedByAccount.unassigned.length}
            </span>
          )}
        </div>
      </motion.div>

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
              content: <TemplateForm mode="create" onSubmit={(c) => startRun(c, 'create')} practiceCount={selectedIds.length} />,
            },
            {
              id: 'delete',
              label: 'Delete Template',
              content: <TemplateForm mode="delete" onSubmit={(c) => startRun(c, 'delete')} practiceCount={selectedIds.length} />,
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
            onChange={(e) => setScreenshotMode(e.target.value)}
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
