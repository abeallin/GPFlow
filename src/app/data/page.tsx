'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, CheckSquare, Upload } from 'lucide-react';
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

export default function DataPage() {
  const [practices, setPractices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadPractices = async () => {
    setLoading(true);
    if (ipc) {
      const data = await ipc.getPractices();
      setPractices(data);
    }
    setLoading(false);
  };

  useEffect(() => { loadPractices(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Data Preview</h1>
          <p className="text-sm text-text-muted mt-1">Manage your practice data</p>
        </div>
        <div className="flex gap-3">
          <CsvImporter onImported={loadPractices} />
          <Button
            onClick={() => {
              sessionStorage.setItem('selectedPracticeIds', JSON.stringify(selectedIds));
              router.push('/templates');
            }}
            disabled={selectedIds.length === 0}
            icon={<CheckSquare className="w-4 h-4" />}
          >
            Continue with {selectedIds.length} selected
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="grid grid-cols-3 gap-4"
      >
        <StatCard label="Total Practices" value={loading ? '...' : practices.length} icon={<Database />} />
        <StatCard label="Selected" value={selectedIds.length} icon={<CheckSquare />} />
        <StatCard label="Data Source" value="CSV" icon={<Upload />} />
      </motion.div>

      {/* Table */}
      <Card className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : practices.length === 0 ? (
          <EmptyState
            icon={<Database />}
            title="No practices loaded"
            description="Import a CSV file to get started with template management."
            action={<CsvImporter onImported={loadPractices} />}
          />
        ) : (
          <DataTable practices={practices} onSelectionChange={setSelectedIds} />
        )}
      </Card>
    </div>
  );
}
