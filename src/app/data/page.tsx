'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, CheckSquare, Trash2, UserCheck, Users, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { DataTable } from '@/components/DataTable';
import { CsvImporter } from '@/components/CsvImporter';
import { ipc } from '@/lib/ipc-client';
import { getAccounts, type Account } from '@/lib/accounts';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'gpflow_practices';
const ASSIGNMENTS_KEY = 'gpflow_assignments';
const FILES_KEY = 'gpflow_uploaded_files';

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

interface UploadedFile {
  fileName: string;
  practiceCount: number;
  accountId: string | null;
}

// Rebuild practices + assignments from stored data and file mappings
function rebuildState(
  allPractices: any[],
  files: UploadedFile[],
): { practices: any[]; assignments: Record<number, string> } {
  const fileAccountMap = new Map<string, string>();
  for (const f of files) {
    if (f.accountId) fileAccountMap.set(f.fileName, f.accountId);
  }

  const assignments: Record<number, string> = {};
  for (const p of allPractices) {
    const accountId = fileAccountMap.get(p.source_file);
    if (accountId) assignments[p.id] = accountId;
  }

  return { practices: allPractices, assignments };
}

export default function DataPage() {
  const [practices, setPractices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const router = useRouter();

  // Load everything from sessionStorage on mount
  useEffect(() => {
    setAccounts(getAccounts());

    if (ipc) {
      ipc.getPractices().then((data) => {
        setPractices(data);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setLoading(false);
      });
      ipc.onPracticesUpdated?.(() => {
        ipc!.getPractices().then((data) => {
          setPractices(data);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        });
      });
      return () => { ipc?.removeAllListeners('db:practices-updated'); };
    } else {
      // Web mode: restore from sessionStorage
      const storedPractices = sessionStorage.getItem(STORAGE_KEY);
      const storedFiles = sessionStorage.getItem(FILES_KEY);
      const storedAssign = sessionStorage.getItem(ASSIGNMENTS_KEY);

      if (storedPractices) setPractices(JSON.parse(storedPractices));
      if (storedFiles) setUploadedFiles(JSON.parse(storedFiles));
      if (storedAssign) setAssignments(JSON.parse(storedAssign));
      setLoading(false);
    }
  }, []);

  // Called by CsvImporter when files are parsed
  const handleWebParsed = (parsed: any[]) => {
    // Merge: dedup by accurx_id WITHIN the same source_file only.
    // Practices from different files get separate entries so they can
    // be independently assigned to different accounts.
    setPractices((prev) => {
      // Keep all existing practices not from the new files
      const newFileNames = new Set(parsed.map((p) => p.source_file));
      const kept = prev.filter((p) => !newFileNames.has(p.source_file));

      // Dedup new practices within each file
      const byKey = new Map<string, any>();
      for (const p of parsed) {
        const key = `${p.source_file}::${p.accurx_id}`;
        if (!byKey.has(key)) byKey.set(key, p);
      }

      // Assign unique IDs to new practices
      const maxId = kept.reduce((max, p) => Math.max(max, p.id || 0), 0);
      let nextId = maxId + 1;
      const newPractices = [...byKey.values()].map((p) => ({ ...p, id: nextId++ }));

      const merged = [...kept, ...newPractices];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });

    // Track uploaded files
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
      sessionStorage.setItem(FILES_KEY, JSON.stringify(updated));
      return updated;
    });

    setLoading(false);
  };

  // Assign a file to an account
  const assignFileToAccount = (fileName: string, accountId: string) => {
    setUploadedFiles((prev) => {
      const updated = prev.map((f) =>
        f.fileName === fileName ? { ...f, accountId } : f
      );
      sessionStorage.setItem(FILES_KEY, JSON.stringify(updated));

      // Rebuild assignments based on file → account mapping
      setPractices((currentPractices) => {
        const { assignments: newAssign } = rebuildState(currentPractices, updated);
        setAssignments(newAssign);
        sessionStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(newAssign));
        return currentPractices;
      });

      return updated;
    });
  };

  const removeFile = (fileName: string) => {
    // Remove practices from this file and update everything
    setPractices((prev) => {
      const remaining = prev.filter((p) => p.source_file !== fileName);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      return remaining;
    });

    setUploadedFiles((prev) => {
      const updated = prev.filter((f) => f.fileName !== fileName);
      sessionStorage.setItem(FILES_KEY, JSON.stringify(updated));

      // Rebuild assignments
      setPractices((currentPractices) => {
        const { assignments: newAssign } = rebuildState(currentPractices, updated);
        setAssignments(newAssign);
        sessionStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(newAssign));
        return currentPractices;
      });

      return updated;
    });
  };

  const handleClear = () => {
    setPractices([]);
    setSelectedIds([]);
    setAssignments({});
    setUploadedFiles([]);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ASSIGNMENTS_KEY);
    sessionStorage.removeItem(FILES_KEY);
    sessionStorage.removeItem('selectedPracticeIds');
  };

  const handleContinue = () => {
    sessionStorage.setItem('selectedPracticeIds', JSON.stringify(selectedIds));
    sessionStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    router.push('/templates');
  };

  const assignedCount = Object.keys(assignments).length;
  const practiceCountByAccount = (accountId: string) =>
    Object.values(assignments).filter((id) => id === accountId).length;
  const hasData = practices.length > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
            Data Preview
          </h1>
          <p className="label mt-2">Upload CSVs and assign to accounts</p>
        </div>
        <div className="flex gap-3">
          {hasData && (
            <Button variant="ghost" onClick={handleClear} icon={<Trash2 className="w-4 h-4" />}>
              Clear All
            </Button>
          )}
          <button
            onClick={handleContinue}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-accent text-text-on-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            style={{ boxShadow: selectedIds.length > 0 ? '0 0 16px rgba(16, 224, 160, 0.2)' : 'none' }}
          >
            <CheckSquare className="w-4 h-4" />
            Continue with {selectedIds.length} selected
          </button>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="grid grid-cols-3 gap-4"
      >
        <motion.div variants={fadeUp}>
          <StatCard label="Total Practices" value={loading ? '...' : practices.length} icon={<Database />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Assigned" value={`${assignedCount}/${practices.length}`} icon={<UserCheck />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Accounts" value={accounts.length} icon={<Users />} />
        </motion.div>
      </motion.div>

      {/* Single drop zone */}
      <CsvImporter
        onImported={() => {}}
        onParsedWeb={handleWebParsed}
        compact={hasData}
      />

      {/* Uploaded files — assign each to an account */}
      {uploadedFiles.length > 0 && accounts.length > 0 && (
        <div className="space-y-2">
          <p className="label">Assign files to accounts</p>
          <AnimatePresence>
            {uploadedFiles.map((file) => (
              <motion.div
                key={file.fileName}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="flex items-center gap-3 glass-card rounded-xl px-4 py-3"
              >
                <FileSpreadsheet className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{file.fileName}</p>
                  <p className="text-xs text-text-muted">{file.practiceCount} practices</p>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => assignFileToAccount(file.fileName, account.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        file.accountId === account.id
                          ? 'bg-accent/15 text-accent border-accent/30'
                          : 'bg-transparent text-text-muted border-border hover:border-accent/30 hover:text-text-secondary'
                      }`}
                    >
                      {account.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => removeFile(file.fileName)}
                  className="p-1 rounded text-text-muted hover:text-error transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {accounts.length === 0 && !hasData && (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-sm text-text-muted">No accounts added. Go back to the login page to add Accurx accounts first.</p>
        </div>
      )}

      {/* Account filter tabs + Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        {hasData && accounts.length > 0 && (
          <div className="flex gap-1 mb-4 bg-bg-root rounded-lg p-1 border border-border-subtle w-fit">
            <button
              onClick={() => setActiveAccount(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeAccount === null
                  ? 'bg-bg-raised text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              All ({practices.length})
            </button>
            {accounts.map((account) => {
              const count = practiceCountByAccount(account.id);
              return (
                <button
                  key={account.id}
                  onClick={() => setActiveAccount(account.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeAccount === account.id
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {account.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        <div className="glass-card rounded-2xl p-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !hasData ? (
            <EmptyState
              icon={<Database />}
              title="No practices loaded"
              description="Drop CSV files above, then assign each to an account."
            />
          ) : (
            <DataTable
              practices={
                activeAccount
                  ? practices.filter((p) => assignments[p.id] === activeAccount)
                  : practices
              }
              onSelectionChange={setSelectedIds}
              assignments={assignments}
              accounts={accounts}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
