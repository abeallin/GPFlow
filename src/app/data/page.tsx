'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Database, CheckSquare, Trash2, UserCheck, Users } from 'lucide-react';
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

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

export default function DataPage() {
  const [practices, setPractices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const router = useRouter();

  const loadPractices = async () => {
    setLoading(true);
    if (ipc) {
      const data = await ipc.getPractices();
      setPractices(data);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setPractices(JSON.parse(stored));
    }
    setLoading(false);
  };

  // Import practices and auto-assign them to an account
  const handleParsedForAccount = useCallback((accountId: string) => (parsed: any[]) => {
    setPractices((prev) => {
      const byAccurxId = new Map(prev.map((p) => [p.accurx_id, p]));
      for (const p of parsed) {
        byAccurxId.set(p.accurx_id, { ...p, id: byAccurxId.get(p.accurx_id)?.id ?? p.id });
      }
      const merged = [...byAccurxId.values()];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

      // Auto-assign new practices to this account
      setAssignments((prevAssign) => {
        const updated = { ...prevAssign };
        for (const p of parsed) {
          const existing = byAccurxId.get(p.accurx_id);
          if (existing) updated[existing.id] = accountId;
        }
        sessionStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(updated));
        return updated;
      });

      return merged;
    });
    setLoading(false);
  }, []);

  const handleClear = () => {
    setPractices([]);
    setSelectedIds([]);
    setAssignments({});
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ASSIGNMENTS_KEY);
    sessionStorage.removeItem('selectedPracticeIds');
  };

  const handleContinue = () => {
    sessionStorage.setItem('selectedPracticeIds', JSON.stringify(selectedIds));
    sessionStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    router.push('/templates');
  };

  useEffect(() => {
    loadPractices();
    setAccounts(getAccounts());

    const stored = sessionStorage.getItem(ASSIGNMENTS_KEY);
    if (stored) setAssignments(JSON.parse(stored));

    if (ipc) {
      ipc.onPracticesUpdated?.(() => loadPractices());
      return () => { ipc?.removeAllListeners('db:practices-updated'); };
    }
  }, []);

  const assignedCount = Object.keys(assignments).length;
  const practiceCountByAccount = (accountId: string) =>
    Object.values(assignments).filter((id) => id === accountId).length;

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
          <p className="label mt-2">Upload one CSV per account</p>
        </div>
        <div className="flex gap-3">
          {practices.length > 0 && (
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

      {/* One drop zone per account */}
      <div className={`grid gap-4 ${accounts.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {accounts.map((account) => {
          const count = practiceCountByAccount(account.id);
          return (
            <div key={account.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                    {account.label}
                  </span>
                  {count > 0 && (
                    <span className="text-xs text-text-muted">{count} practices</span>
                  )}
                </div>
                <span className="text-xs text-text-muted">{account.username}</span>
              </div>
              <CsvImporter
                onImported={loadPractices}
                onParsedWeb={handleParsedForAccount(account.id)}
                compact={count > 0}
              />
            </div>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-sm text-text-muted">No accounts added. Go back to the login page to add Accurx accounts first.</p>
        </div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div className="glass-card rounded-2xl p-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : practices.length === 0 ? (
            <EmptyState
              icon={<Database />}
              title="No practices loaded"
              description="Upload a CSV file for each account above."
            />
          ) : (
            <DataTable
              practices={practices}
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
