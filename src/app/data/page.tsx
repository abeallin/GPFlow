'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/DataTable';
import { CsvImporter } from '@/components/CsvImporter';
import { ipc } from '@/lib/ipc-client';
import { useRouter } from 'next/navigation';

export default function DataPage() {
  const [practices, setPractices] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const router = useRouter();

  const loadPractices = async () => {
    if (!ipc) return;
    const data = await ipc.getPractices();
    setPractices(data);
  };

  useEffect(() => { loadPractices(); }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Preview</h1>
          <p className="text-gray-500">{practices.length} practices loaded</p>
        </div>
        <div className="flex gap-3">
          <CsvImporter onImported={loadPractices} />
          <Button
            onClick={() => {
              sessionStorage.setItem('selectedPracticeIds', JSON.stringify(selectedIds));
              router.push('/templates');
            }}
            disabled={selectedIds.length === 0}
          >
            Continue with {selectedIds.length} selected
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <DataTable practices={practices} onSelectionChange={setSelectedIds} />
      </Card>
    </div>
  );
}
