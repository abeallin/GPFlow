'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './ui/Badge';
import { ipc } from '@/lib/ipc-client';

interface CsvImporterProps {
  onImported: () => void;
  onParsedWeb?: (practices: any[]) => void;
  compact?: boolean;
}

function parseCsvText(text: string, fileName: string): { practices: any[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.trim().split('\n');

  if (lines.length < 2) {
    return { practices: [], errors: ['CSV file is empty or has no data rows'] };
  }

  const rawHeader = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim());
  const header = rawHeader.map((h) => h.toLowerCase().replace(/\s+/g, '_'));

  const accurxIdx = header.indexOf('accurx_id');
  if (accurxIdx === -1) {
    return { practices: [], errors: ['CSV must contain an "accurx_id" or "Accurx_Id" column'] };
  }

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

export function CsvImporter({ onImported, onParsedWeb, compact = false }: CsvImporterProps) {
  const [result, setResult] = useState<{ rowCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setLoading(true);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { practices, errors } = parseCsvText(text, file.name);
      setResult({ rowCount: practices.length, errors });
      setLoading(false);
      if (practices.length > 0) {
        onParsedWeb?.(practices);
        onImported();
      }
    };
    reader.readAsText(file);
  }, [onImported, onParsedWeb]);

  const handleElectronImport = async () => {
    if (!ipc) return;
    setLoading(true);
    const res = await ipc.importCsv();
    setResult(res);
    setLoading(false);
    if (res.rowCount > 0) onImported();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (ipc) {
      handleElectronImport();
    } else {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setResult({ rowCount: 0, errors: ['Please drop a .csv file'] });
      return;
    }

    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const hasResult = result && result.rowCount > 0;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
      />

      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        whileTap={{ scale: 0.99 }}
        className={`relative cursor-pointer border-2 border-dashed rounded-xl text-center transition-all duration-200
          ${compact ? 'p-3' : 'p-6'}
          ${dragging
            ? 'border-accent bg-accent-subtle scale-[1.01]'
            : hasResult
              ? 'border-accent/30 bg-accent-subtle'
              : 'border-border-strong hover:border-accent/40 hover:bg-bg-overlay'
          }`}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={compact ? 'flex items-center justify-center gap-2' : 'flex flex-col items-center gap-2'}
            >
              <div className={`rounded-full border-2 border-accent border-t-transparent animate-spin ${compact ? 'w-5 h-5' : 'w-10 h-10'}`} />
              <p className="text-sm text-text-secondary">Importing...</p>
            </motion.div>
          ) : hasResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={compact ? 'flex items-center justify-center gap-3' : 'flex flex-col items-center gap-2'}
            >
              {!compact && <CheckCircle className="w-10 h-10 text-success" />}
              <div className="flex items-center gap-2">
                <Badge variant="success" dot>{result.rowCount} records imported</Badge>
                {result.errors.length > 0 && (
                  <Badge variant="warning" dot>{result.errors.length} warnings</Badge>
                )}
              </div>
              <p className="text-xs text-text-muted">{compact ? 'Click to replace' : 'Drop another file or click to replace'}</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={compact ? 'flex items-center justify-center gap-3' : 'flex flex-col items-center gap-3'}
            >
              <div className={`rounded-xl flex items-center justify-center transition-colors duration-200 ${
                compact ? 'w-8 h-8' : 'w-12 h-12'
              } ${dragging ? 'bg-accent/10 text-accent' : 'bg-bg-overlay text-text-muted'}`}>
                {dragging ? <FileSpreadsheet className={compact ? 'w-4 h-4' : 'w-6 h-6'} /> : <Upload className={compact ? 'w-4 h-4' : 'w-6 h-6'} />}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {dragging ? 'Drop your CSV here' : compact ? 'Drop CSV or click to replace' : 'Drop CSV file or click to browse'}
                </p>
                {!compact && <p className="text-xs text-text-muted mt-0.5">Supports .csv files with an accurx_id column</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {result && result.rowCount === 0 && result.errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3"
          >
            <Badge variant="error" dot>{result.errors[0]}</Badge>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
