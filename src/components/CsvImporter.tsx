'use client';

import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ipc } from '@/lib/ipc-client';

interface CsvImporterProps {
  onImported: () => void;
  onParsedWeb?: (practices: any[]) => void;
}

function parseCsvText(text: string, fileName: string): { practices: any[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.trim().split('\n');

  if (lines.length < 2) {
    return { practices: [], errors: ['CSV file is empty or has no data rows'] };
  }

  const rawHeader = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim());
  // Normalize headers to lowercase with underscores for consistent access
  const header = rawHeader.map((h) => h.toLowerCase().replace(/\s+/g, '_'));

  const accurxIdx = header.indexOf('accurx_id');
  if (accurxIdx === -1) {
    return { practices: [], errors: ['CSV must contain an "accurx_id" or "Accurx_Id" column'] };
  }

  // Find name column (could be "name", "Practice Name", "Name on Accurx", etc.)
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'practice_name' || h === 'name_on_accurx');

  const practices: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};

    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] || '';
    }

    if (!row.accurx_id) {
      errors.push(`Row ${i + 1}: missing accurx_id, skipped`);
      continue;
    }

    practices.push({
      id: i,
      name: (nameIdx !== -1 ? values[nameIdx] : '') || '',
      accurx_id: row.accurx_id,
      source_file: fileName,
      ...row,
    });
  }

  return { practices, errors };
}

export function CsvImporter({ onImported, onParsedWeb }: CsvImporterProps) {
  const [result, setResult] = useState<{ rowCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleElectronImport = async () => {
    if (!ipc) return;
    setLoading(true);
    const res = await ipc.importCsv();
    setResult(res);
    setLoading(false);
    if (res.rowCount > 0) onImported();
  };

  const handleWebImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { practices, errors } = parseCsvText(text, file.name);
      setResult({ rowCount: practices.length, errors });
      setLoading(false);
      if (practices.length > 0) {
        onParsedWeb?.(practices);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleClick = () => {
    if (ipc) {
      handleElectronImport();
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input for web mode */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleWebImport}
        className="hidden"
      />

      <Button
        variant="secondary"
        onClick={handleClick}
        loading={loading}
        icon={<Upload className="w-4 h-4" />}
      >
        Import CSV
      </Button>

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
