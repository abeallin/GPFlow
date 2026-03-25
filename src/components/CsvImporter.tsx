'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';
import { ipc } from '@/lib/ipc-client';

interface CsvImporterProps {
  onImported: () => void;
}

export function CsvImporter({ onImported }: CsvImporterProps) {
  const [result, setResult] = useState<{ rowCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [noIpcError, setNoIpcError] = useState(false);

  const handleImport = async () => {
    if (!ipc) {
      setNoIpcError(true);
      return;
    }
    setLoading(true);
    setNoIpcError(false);
    const res = await ipc.importCsv();
    setResult(res);
    setLoading(false);
    if (res.rowCount > 0) onImported();
  };

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        onClick={handleImport}
        loading={loading}
        icon={<Upload className="w-4 h-4" />}
        className="glass-card border border-border-subtle hover:border-accent/30 transition-colors"
      >
        Import CSV
      </Button>
      {noIpcError && (
        <Alert variant="warning" onDismiss={() => setNoIpcError(false)}>
          CSV import requires the desktop app. Please run GP Flow via Electron.
        </Alert>
      )}
      {result && (
        <div className="flex items-center gap-2">
          <Badge variant={result.rowCount > 0 ? 'success' : 'error'} dot>
            {result.rowCount} records imported
          </Badge>
          {result.errors.length > 0 && (
            <Badge variant="warning" dot>{result.errors.length} warnings</Badge>
          )}
        </div>
      )}
    </div>
  );
}
