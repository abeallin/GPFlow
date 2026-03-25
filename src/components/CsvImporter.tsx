'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ipc } from '@/lib/ipc-client';

interface CsvImporterProps {
  onImported: () => void;
}

export function CsvImporter({ onImported }: CsvImporterProps) {
  const [result, setResult] = useState<{ rowCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!ipc) return;
    setLoading(true);
    const res = await ipc.importCsv();
    setResult(res);
    setLoading(false);
    if (res.rowCount > 0) onImported();
  };

  return (
    <div className="flex items-center gap-4">
      <Button variant="secondary" onClick={handleImport} disabled={loading}>
        {loading ? 'Importing...' : 'Import CSV'}
      </Button>
      {result && (
        <div className="flex items-center gap-2">
          <Badge variant={result.rowCount > 0 ? 'success' : 'error'}>
            {result.rowCount} records imported
          </Badge>
          {result.errors.length > 0 && (
            <Badge variant="warning">{result.errors.length} warnings</Badge>
          )}
        </div>
      )}
    </div>
  );
}
