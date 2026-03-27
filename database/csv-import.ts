import type Database from 'better-sqlite3';
import fs from 'fs';
import { upsertPractices } from './queries/practices';

interface CsvImportResult {
  rowCount: number;
  errors: string[];
}

/** RFC 4180-aware CSV line parser */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function importCsv(db: Database.Database, filePath: string): CsvImportResult {
  const errors: string[] = [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    return { rowCount: 0, errors: ['CSV file is empty or has no data rows'] };
  }

  const rawHeader = parseCsvLine(lines[0].replace(/^\uFEFF/, ''));
  const header = rawHeader.map((h) => h.toLowerCase().replace(/\s+/g, '_'));

  if (!header.includes('accurx_id')) {
    return { rowCount: 0, errors: ['CSV must contain an "accurx_id" or "Accurx_Id" column'] };
  }

  const nameIdx = header.findIndex((h) => h === 'name' || h === 'practice_name' || h === 'name_on_accurx');

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};

    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] || '';
    }

    if (!row.accurx_id) {
      errors.push(`Row ${i + 1}: missing accurx_id, skipped`);
      continue;
    }

    if (nameIdx !== -1 && !row.name) {
      row.name = values[nameIdx] || '';
    }

    rows.push(row);
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const result = upsertPractices(db, rows, fileName);

  return { rowCount: result.inserted + result.updated, errors };
}
