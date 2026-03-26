'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, CheckSquare, Upload, FolderOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { DataTable } from '@/components/DataTable';
import { CsvImporter } from '@/components/CsvImporter';
import { ipc } from '@/lib/ipc-client';
import { useRouter } from 'next/navigation';

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
  const [importFolder, setImportFolder] = useState<string | null>(null);
  const router = useRouter();

  const loadPractices = async () => {
    setLoading(true);
    if (ipc) {
      const data = await ipc.getPractices();
      setPractices(data);
    }
    setLoading(false);
  };

  const handleWebParsed = (parsed: any[]) => {
    setPractices(parsed);
  };

  useEffect(() => {
    loadPractices();

    // Get import folder path (Electron only)
    if (ipc) {
      ipc.getImportFolder?.().then(setImportFolder).catch(() => {});

      // Listen for auto-import events
      ipc.onPracticesUpdated?.(() => {
        loadPractices();
      });

      return () => {
        ipc?.removeAllListeners('db:practices-updated');
      };
    }
  }, []);

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
          <p className="label mt-2">Manage your practice data</p>
        </div>
        <div className="flex gap-3">
          <CsvImporter onImported={loadPractices} onParsedWeb={handleWebParsed} />
          <button
            onClick={() => {
              sessionStorage.setItem('selectedPracticeIds', JSON.stringify(selectedIds));
              router.push('/templates');
            }}
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
          <StatCard label="Selected" value={selectedIds.length} icon={<CheckSquare />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Data Source" value="CSV" icon={<Upload />} />
        </motion.div>
      </motion.div>

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
            <div>
              <EmptyState
                icon={<Database />}
                title="No practices loaded"
                description="Import a CSV file to get started with template management."
                action={<CsvImporter onImported={loadPractices} onParsedWeb={handleWebParsed} />}
              />
              {importFolder && (
                <div className="flex items-center gap-2 justify-center mt-2 text-text-muted text-xs">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Or drop CSV files into <code className="font-mono text-text-secondary bg-bg-overlay px-1.5 py-0.5 rounded">{importFolder}</code></span>
                </div>
              )}
            </div>
          ) : (
            <DataTable practices={practices} onSelectionChange={setSelectedIds} />
          )}
        </div>
      </motion.div>
    </div>
  );
}
