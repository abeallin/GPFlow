'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { Badge } from './ui/Badge';
import { parseCsv } from '@/lib/csv-parser';
import type { PracticeLike } from '@/lib/assignments';

interface CsvImporterProps {
  onImported: () => void;
  onParsedWeb?: (practices: PracticeLike[]) => void;
  compact?: boolean;
}

function parseCsvText(text: string, fileName: string): { practices: PracticeLike[]; errors: string[] } {
  const { header: rawHeader, rows, errors: parseErrors } = parseCsv(text);

  if (rawHeader.length === 0 || rows.length === 0) {
    return { practices: [], errors: ['CSV file is empty or has no data rows'] };
  }

  const errors: string[] = [...parseErrors];
  const header = rawHeader.map((h) => h.toLowerCase().replace(/\s+/g, '_'));

  // Duplicate detection on the normalised names too ("Name" vs "name").
  const seen = new Map<string, number>();
  for (const h of header) seen.set(h, (seen.get(h) ?? 0) + 1);
  for (const [name, count] of seen) {
    if (count > 1 && !errors.some((e) => e.includes(`"${name}"`))) {
      errors.push(`Duplicate header "${name}" appears ${count} times`);
    }
  }

  const accurxIdx = header.indexOf('accurx_id');
  if (accurxIdx === -1) {
    return { practices: [], errors: ['CSV must contain an "accurx_id" or "Accurx_Id" column'] };
  }

  const nameIdx = header.findIndex((h) => h === 'name' || h === 'practice_name' || h === 'name_on_accurx');
  const practices: PracticeLike[] = [];

  rows.forEach((values, i) => {
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] || '';
    }

    if (!row.accurx_id) {
      errors.push(`Row ${i + 2}: missing accurx_id, skipped`);
      return;
    }

    practices.push({
      id: i + 1,
      name: (nameIdx !== -1 ? values[nameIdx] : '') || '',
      accurx_id: row.accurx_id,
      source_file: fileName,
      ...row,
    });
  });

  return { practices, errors };
}

/**
 * The drop zone is a real button (docs/ui-rules.md §8): reachable by keyboard,
 * named for assistive tech, and it opens the native file picker.
 */
export function CsvImporter({ onImported, onParsedWeb, compact = false }: CsvImporterProps) {
  const [result, setResult] = useState<{ rowCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Latest callbacks for the async FileReader completions, synced after render (never during it).
  const onParsedWebRef = useRef(onParsedWeb);
  const onImportedRef = useRef(onImported);
  useEffect(() => {
    onParsedWebRef.current = onParsedWeb;
    onImportedRef.current = onImported;
  });

  const processFiles = (files: File[]) => {
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'));
    if (csvFiles.length === 0) {
      setResult({ rowCount: 0, errors: ['Please select .csv files'] });
      return;
    }

    setLoading(true);
    setResult(null);

    let totalRows = 0;
    const allErrors: string[] = [];
    const allPractices: PracticeLike[] = [];
    let processed = 0;

    const finish = () => {
      processed++;
      if (processed === csvFiles.length) {
        setResult({ rowCount: totalRows, errors: allErrors });
        setLoading(false);
        if (allPractices.length > 0) {
          onParsedWebRef.current?.(allPractices);
          onImportedRef.current();
        }
      }
    };

    for (const file of csvFiles) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { practices, errors } = parseCsvText(text, file.name);
        totalRows += practices.length;
        allErrors.push(...errors);
        allPractices.push(...practices);
        finish();
      };
      reader.onerror = () => {
        allErrors.push(`${file.name}: could not be read`);
        finish();
      };
      reader.readAsText(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles([...files]);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const hasResult = result && result.rowCount > 0;
  const failed = result && result.rowCount === 0 && result.errors.length > 0;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileInput}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        aria-label="Choose CSV files"
        aria-busy={loading || undefined}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl text-center transition-colors duration-150
          ${compact ? 'p-3' : 'p-6'}
          ${dragging
            ? 'border-accent bg-accent-subtle'
            : hasResult
              ? 'border-accent/30 bg-accent-subtle'
              : 'border-edge hover:border-accent/40 hover:bg-bg-overlay'
          }`}
      >
        {loading ? (
          <div className={compact ? 'flex items-center justify-center gap-2' : 'flex flex-col items-center gap-2'}>
            <div className={`rounded-full border-2 border-accent border-t-transparent animate-spin motion-reduce:animate-none ${compact ? 'w-5 h-5' : 'w-10 h-10'}`} aria-hidden="true" />
            <p className="text-sm text-text-secondary">Reading files…</p>
          </div>
        ) : hasResult ? (
          <div className={compact ? 'flex items-center justify-center gap-3' : 'flex flex-col items-center gap-2'}>
            {!compact && <CheckCircle className="w-10 h-10 text-accent" aria-hidden="true" />}
            <div className="flex items-center gap-2">
              <Badge variant="success">{result.rowCount} records imported</Badge>
              {result.errors.length > 0 && (
                <Badge variant="warning">{result.errors.length} warnings</Badge>
              )}
            </div>
            <p className="text-xs text-text-secondary">{compact ? 'Drop or choose more files' : 'Drop another file or choose more'}</p>
          </div>
        ) : (
          <div className={compact ? 'flex items-center justify-center gap-3' : 'flex flex-col items-center gap-3'}>
            <div className={`rounded-xl flex items-center justify-center ${compact ? 'w-8 h-8' : 'w-12 h-12'} ${dragging ? 'bg-accent/10 text-accent' : 'bg-bg-overlay text-text-secondary'}`} aria-hidden="true">
              {dragging ? <FileSpreadsheet className={compact ? 'w-4 h-4' : 'w-6 h-6'} /> : <Upload className={compact ? 'w-4 h-4' : 'w-6 h-6'} />}
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {dragging ? 'Drop your CSV here' : compact ? 'Drop CSV or choose files' : 'Drop CSV files or click to browse'}
              </p>
              {!compact && <p className="text-xs text-text-secondary mt-0.5">Supports multiple .csv files with an accurx_id column</p>}
            </div>
          </div>
        )}
      </button>

      {failed && (
        <p role="alert" className="text-sm text-error-text">{result.errors[0]}</p>
      )}
    </div>
  );
}
