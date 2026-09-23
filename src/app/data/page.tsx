'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, CheckSquare, Trash2, UserCheck, Users, FileSpreadsheet, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import { DataTable } from '@/components/DataTable';
import { CsvImporter } from '@/components/CsvImporter';
import { ipc } from '@/lib/ipc-client';
import { getAccounts, type Account } from '@/lib/accounts';
import {
  rebuildAssignments,
  findCrossAccountDuplicates,
  assignedAccountId,
  allocatePracticeIds,
  type Assignments,
  type PracticeLike,
} from '@/lib/assignments';
import { readJson, isArray, isStringRecord } from '@/lib/storage';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'gpflow_practices';
const ASSIGNMENTS_KEY = 'gpflow_assignments';
const FILES_KEY = 'gpflow_uploaded_files';

interface UploadedFile {
  fileName: string;
  practiceCount: number;
  accountId: string | null;
}

const isUploadedFileArray = (v: unknown): v is UploadedFile[] =>
  Array.isArray(v) && v.every((f) => typeof f === 'object' && f !== null && typeof (f as UploadedFile).fileName === 'string');

export default function DataPage() {
  usePageTitle('Data');
  const [practices, setPractices] = useState<PracticeLike[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // Keyed by the composite practice key `${source_file}::${accurx_id}` → account ID
  const [assignments, setAssignments] = useState<Assignments>({});
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const router = useRouter();

  const autoSelect = useCallback((practiceList: PracticeLike[], assign: Assignments) => {
    const assignedIds = practiceList.filter((p) => assignedAccountId(p, assign)).map((p) => p.id);
    if (assignedIds.length > 0) setSelectedIds(assignedIds);
  }, []);

  /** Electron: SQLite is the source of the auto-imported practices. Unknown is not empty. */
  const loadFromElectron = useCallback(async (assign: Assignments) => {
    if (!ipc) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ipc.getPractices();
      const list: PracticeLike[] = Array.isArray(data) ? data : [];
      setPractices(list);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      autoSelect(list, assign);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'The practice list could not be read.');
    } finally {
      setLoading(false);
    }
  }, [autoSelect]);

  useEffect(() => {
    setAccounts(getAccounts());

    const files = readJson<UploadedFile[]>(localStorage, FILES_KEY, [], isUploadedFileArray);
    const assign = readJson<Assignments>(localStorage, ASSIGNMENTS_KEY, {}, isStringRecord);
    setUploadedFiles(files);
    setAssignments(assign);

    if (ipc) {
      const api = ipc;
      void loadFromElectron(assign);
      api.onPracticesUpdated?.(() => { void loadFromElectron(assign); });
      return () => { api.removeAllListeners('db:practices-updated'); };
    }

    const stored = readJson<PracticeLike[]>(localStorage, STORAGE_KEY, [], isArray);
    if (stored.length) setPractices(stored);
    autoSelect(stored, assign);
    setLoading(false);
  }, [autoSelect, loadFromElectron]);

  const handleWebParsed = (parsed: PracticeLike[]) => {
    setPractices((prev) => {
      const newFileNames = new Set(parsed.map((p) => p.source_file));
      const kept = prev.filter((p) => !newFileNames.has(p.source_file));

      const byKey = new Map<string, PracticeLike>();
      for (const p of parsed) {
        const key = `${p.source_file}::${p.accurx_id}`;
        if (!byKey.has(key)) byKey.set(key, p);
      }

      const unique = [...byKey.values()];
      const ids = allocatePracticeIds(unique.length, localStorage);
      const newPractices = unique.map((p, i) => ({ ...p, id: ids[i] }));

      const merged = [...kept, ...newPractices];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });

    const byFile = new Map<string, number>();
    for (const p of parsed) {
      const file = p.source_file || 'unknown.csv';
      byFile.set(file, (byFile.get(file) || 0) + 1);
    }

    setUploadedFiles((prev) => {
      const existing = new Map(prev.map((f) => [f.fileName, f]));
      for (const [fileName, count] of byFile) {
        existing.set(fileName, {
          fileName,
          practiceCount: count,
          accountId: existing.get(fileName)?.accountId ?? null,
        });
      }
      const updated = [...existing.values()];
      localStorage.setItem(FILES_KEY, JSON.stringify(updated));
      return updated;
    });

    setLoading(false);
    setLoadError(null);
    toast({ tone: 'success', title: `${parsed.length} practices imported`, message: 'Assign each file to an account below.' });
  };

  const applyFiles = (updated: UploadedFile[]) => {
    setUploadedFiles(updated);
    localStorage.setItem(FILES_KEY, JSON.stringify(updated));
    setPractices((currentPractices) => {
      const newAssign = rebuildAssignments(currentPractices, updated);
      setAssignments(newAssign);
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(newAssign));
      return currentPractices;
    });
  };

  const assignFileToAccount = (fileName: string, accountId: string) => {
    applyFiles(uploadedFiles.map((f) => (f.fileName === fileName ? { ...f, accountId } : f)));
  };

  const removeFile = (fileName: string) => {
    setPractices((prev) => {
      const remaining = prev.filter((p) => p.source_file !== fileName);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      return remaining;
    });
    applyFiles(uploadedFiles.filter((f) => f.fileName !== fileName));
  };

  const handleClear = async () => {
    if (ipc) await ipc.clearPractices();
    setPractices([]);
    setSelectedIds([]);
    setAssignments({});
    setUploadedFiles([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ASSIGNMENTS_KEY);
    localStorage.removeItem(FILES_KEY);
    sessionStorage.removeItem('selectedPracticeIds');
    setConfirmClear(false);
    toast({ tone: 'success', title: 'All practices removed' });
  };

  const getDuplicates = () => findCrossAccountDuplicates(selectedIds, practices, assignments);

  const autoResolveDuplicates = () => {
    const dupes = getDuplicates();
    const idsToRemove = new Set<number>();
    for (const { entries } of dupes) {
      for (let i = 1; i < entries.length; i++) idsToRemove.add(entries[i].id);
    }
    setSelectedIds(selectedIds.filter((id) => !idsToRemove.has(id)));
    setShowDuplicates(false);
  };

  const isAssigned = (practiceId: number) => {
    const p = practices.find((pr) => pr.id === practiceId);
    return p ? !!assignedAccountId(p, assignments) : false;
  };

  const continueToTemplates = (ids: number[]) => {
    sessionStorage.setItem('selectedPracticeIds', JSON.stringify(ids));
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    router.push('/templates');
  };

  const handleContinue = () => {
    const assignedSelected = selectedIds.filter((id) => isAssigned(id));
    if (assignedSelected.length === 0) return;
    if (getDuplicates().length > 0) {
      setShowDuplicates(true);
      return;
    }
    continueToTemplates(assignedSelected);
  };

  const forceContinue = () => continueToTemplates(selectedIds.filter((id) => isAssigned(id)));

  const assignedCount = practices.filter((p) => assignedAccountId(p, assignments)).length;
  const practiceCountByAccount = (accountId: string) =>
    practices.filter((p) => assignedAccountId(p, assignments) === accountId).length;
  const hasData = practices.length > 0;
  const duplicates = showDuplicates ? getDuplicates() : [];
  const assignedSelectedCount = selectedIds.filter((id) => isAssigned(id)).length;
  const unassignedSelectedCount = selectedIds.length - assignedSelectedCount;
  const known = !loading && !loadError;

  const continueReason = assignedSelectedCount === 0
    ? (hasData ? 'Select at least one assigned practice to continue.' : 'Import a CSV and assign it to an account to continue.')
    : undefined;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
            Data Preview
          </h1>
          <p className="text-sm text-text-secondary mt-1">Upload CSVs and assign each file to an Accurx account.</p>
        </div>
        <div className="flex gap-3 items-start">
          {hasData && (
            <Button variant="ghost" onClick={() => setConfirmClear(true)} icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}>
              Clear all
            </Button>
          )}
          <div>
            <Button
              onClick={handleContinue}
              disabledReason={continueReason}
              icon={<CheckSquare className="w-4 h-4" aria-hidden="true" />}
            >
              Continue with {assignedSelectedCount} selected
              {unassignedSelectedCount > 0 && (
                <span className="text-xs font-normal">({unassignedSelectedCount} unassigned skipped)</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total practices" value={known ? practices.length : null} icon={<Database />} />
        <StatCard label="Assigned" value={known ? `${assignedCount}/${practices.length}` : null} icon={<UserCheck />} />
        <StatCard label="Accounts" value={accounts.length} icon={<Users />} />
      </div>

      <CsvImporter
        onImported={() => {}}
        onParsedWeb={handleWebParsed}
        compact={hasData}
      />

      {uploadedFiles.length > 0 && accounts.length > 0 && (
        <section aria-labelledby="assign-heading" className="space-y-2">
          <h2 id="assign-heading" className="text-xs font-semibold text-text-secondary font-[var(--font-body)] tracking-normal">Assign files to accounts</h2>
          <ul className="space-y-2 list-none m-0 p-0">
            {uploadedFiles.map((file) => (
              <li
                key={file.fileName}
                className="flex items-center gap-3 rounded-xl border border-border bg-bg-raised px-4 py-3"
              >
                <FileSpreadsheet className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{file.fileName}</p>
                  <p className="text-xs text-text-secondary tabular-nums">{file.practiceCount} practices</p>
                </div>

                <div role="group" aria-label={`Account for ${file.fileName}`} className="flex gap-1.5 shrink-0">
                  {accounts.map((account) => {
                    const selected = file.accountId === account.id;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => assignFileToAccount(file.fileName, account.id)}
                        className={`min-h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-accent/15 text-accent border-accent/30'
                            : 'bg-transparent text-text-secondary border-edge hover:border-accent/30 hover:text-text-primary'
                        }`}
                      >
                        {account.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  aria-label={`Remove file ${file.fileName}`}
                  onClick={() => removeFile(file.fileName)}
                  className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-error-text transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {accounts.length === 0 && !hasData && (
        <p className="rounded-xl border border-border bg-bg-raised p-6 text-center text-sm text-text-secondary">
          No accounts added. Go back to the login page to add Accurx accounts first.
        </p>
      )}

      {showDuplicates && duplicates.length > 0 && (
        <section aria-labelledby="dupes-heading" className="rounded-xl border border-warning/30 bg-bg-raised p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h2 id="dupes-heading" className="text-sm font-medium text-text-primary font-[var(--font-body)] tracking-normal">
                {duplicates.length} practice{duplicates.length > 1 ? 's' : ''} assigned to multiple accounts
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                The same accurx_id appears in files assigned to different accounts. Resolve before continuing.
              </p>
            </div>
          </div>

          <ul className="max-h-48 overflow-y-auto space-y-1.5 list-none m-0 p-0">
            {duplicates.map(({ accurxId, name, entries }) => (
              <li key={accurxId} className="flex items-center gap-3 text-xs bg-bg-root rounded-lg px-3 py-2">
                <span className="font-mono text-text-secondary w-16 shrink-0">{accurxId}</span>
                <span className="text-text-primary truncate flex-1">{name}</span>
                <div className="flex gap-1 shrink-0">
                  {entries.map((e) => {
                    const account = accounts.find((a) => a.id === e.accountId);
                    return (
                      <span key={e.id} className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                        {account?.label || '?'}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={autoResolveDuplicates}>Auto-resolve (keep first assignment)</Button>
            <Button size="sm" variant="secondary" onClick={forceContinue}>Continue anyway</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDuplicates(false)}>Dismiss</Button>
          </div>
        </section>
      )}

      <div>
        {hasData && accounts.length > 0 && (
          <div role="group" aria-label="Filter by account" className="flex gap-1 mb-4 bg-bg-root rounded-lg p-1 border border-border-subtle w-fit">
            <button
              type="button"
              aria-pressed={activeAccount === null}
              onClick={() => setActiveAccount(null)}
              className={`min-h-9 px-3 rounded-md text-xs font-medium transition-colors tabular-nums ${
                activeAccount === null ? 'bg-bg-raised text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({practices.length})
            </button>
            {accounts.map((account) => {
              const count = practiceCountByAccount(account.id);
              return (
                <button
                  key={account.id}
                  type="button"
                  aria-pressed={activeAccount === account.id}
                  onClick={() => setActiveAccount(account.id)}
                  className={`min-h-9 px-3 rounded-md text-xs font-medium transition-colors tabular-nums ${
                    activeAccount === account.id ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {account.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-border bg-bg-raised p-5" aria-busy={loading || undefined}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : loadError ? (
            <LoadError
              title="Couldn't load practices"
              message={`${loadError} Nothing has changed.`}
              onRetry={() => { void loadFromElectron(assignments); }}
            />
          ) : !hasData ? (
            <EmptyState
              icon={<Database />}
              title="No practices loaded"
              description="Practices from CSV files you drop above will appear here, one row per practice."
            />
          ) : (
            <DataTable
              practices={
                activeAccount
                  ? practices.filter((p) => assignedAccountId(p, assignments) === activeAccount)
                  : practices
              }
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              assignments={assignments}
              accounts={accounts}
            />
          )}
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title={`Remove all ${practices.length} practice${practices.length === 1 ? '' : 's'}?`}
          body="Every imported file, assignment and selection on this device is removed. Accounts and their passwords are kept."
          confirmLabel={`Remove ${practices.length} practice${practices.length === 1 ? '' : 's'}`}
          pendingLabel="Removing…"
          tone="destructive"
          onCancel={() => setConfirmClear(false)}
          onConfirm={handleClear}
        />
      )}
    </div>
  );
}
