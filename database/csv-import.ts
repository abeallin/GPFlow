import type Database from 'better-sqlite3';
import fs from 'fs';
import { upsertPractices } from './queries/practices';
import { parseCsv } from '../src/lib/csv-parser';

interface CsvImportResult {
  rowCount: number;
  errors: string[];
}

const NAME_HEADERS = ['name', 'practice_name', 'name_on_accurx'];

export function importCsv(db: Database.Database, filePath: string): CsvImportResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseCsv(content);

  if (parsed.header.length === 0 || parsed.rows.length === 0) {
    return { rowCount: 0, errors: ['CSV file is empty or has no data rows'] };
  }

  const header = parsed.header.map((h) => h.toLowerCase().replace(/\s+/g, '_'));

  if (!header.includes('accurx_id')) {
    return { rowCount: 0, errors: ['CSV must contain an "accurx_id" or "Accurx_Id" column'] };
  }

  // Duplicate headers would silently overwrite a column; refuse the file.
  const seen = new Set<string>();
  for (const h of header) {
    if (seen.has(h)) return { rowCount: 0, errors: [`Duplicate header "${h}" — each column name must be unique`] };
    seen.add(h);
  }

  const nameIdx = header.findIndex((h) => NAME_HEADERS.includes(h));
  const errors: string[] = [];
  const rows: Record<string, string>[] = [];

  parsed.rows.forEach((values, i) => {
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] ?? '';
    }

    if (!row.accurx_id) {
      errors.push(`Row ${i + 2}: missing accurx_id, skipped`);
      return;
    }

    if (nameIdx !== -1 && !row.name) {
      row.name = values[nameIdx] ?? '';
    }

    rows.push(row);
  });

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const result = upsertPractices(db, rows, fileName);

  return { rowCount: result.inserted + result.updated, errors };
}
