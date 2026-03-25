import type Database from 'better-sqlite3';
import fs from 'fs';
import { upsertPractices } from './queries/practices';

interface CsvImportResult {
  rowCount: number;
  errors: string[];
}

export function importCsv(db: Database.Database, filePath: string): CsvImportResult {
  const errors: string[] = [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    return { rowCount: 0, errors: ['CSV file is empty or has no data rows'] };
  }

  const header = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim());

  if (!header.includes('accurx_id')) {
    return { rowCount: 0, errors: ['CSV must contain an "accurx_id" column'] };
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};

    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] || '';
    }

    if (!row.accurx_id) {
      errors.push(`Row ${i + 1}: missing accurx_id, skipped`);
      continue;
    }

    rows.push(row);
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const result = upsertPractices(db, rows, fileName);

  return { rowCount: result.inserted + result.updated, errors };
}
