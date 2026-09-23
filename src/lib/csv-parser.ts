/**
 * RFC 4180 CSV tokenizer.
 *
 * Handles quoted fields containing commas, embedded CR/LF, and "" escapes;
 * CRLF and LF line endings; a leading BOM; a trailing newline; and blank lines
 * (which are skipped).
 */

export interface ParsedCsv {
  header: string[];
  rows: string[][];
  errors: string[];
}

/** Tokenise the whole text into records. Blank records are skipped. */
export function tokenizeCsv(text: string): string[][] {
  const src = text.startsWith('﻿') ? text.slice(1) : text;
  const records: string[][] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;
  /** True once the current field was opened with a quote (so it is not trimmed). */
  let quotedField = false;
  let i = 0;

  const endField = () => {
    fields.push(quotedField ? current : current.trim());
    current = '';
    quotedField = false;
  };
  const endRecord = () => {
    endField();
    const blank = fields.length === 1 && fields[0] === '';
    if (!blank) records.push(fields);
    fields = [];
  };

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      quotedField = true;
      i++;
    } else if (ch === ',') {
      endField();
      i++;
    } else if (ch === '\r') {
      endRecord();
      i += src[i + 1] === '\n' ? 2 : 1;
    } else if (ch === '\n') {
      endRecord();
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  // Flush the last record if the text did not end with a newline.
  if (current !== '' || quotedField || fields.length > 0) endRecord();

  return records;
}

export function parseCsv(text: string): ParsedCsv {
  const records = tokenizeCsv(text);
  if (records.length === 0) return { header: [], rows: [], errors: [] };

  const [header, ...rows] = records;
  const errors: string[] = [];

  const seen = new Map<string, number>();
  for (const h of header) seen.set(h, (seen.get(h) ?? 0) + 1);
  for (const [name, count] of seen) {
    if (count > 1) errors.push(`Duplicate header "${name}" appears ${count} times`);
  }

  return { header, rows, errors };
}

/**
 * Parse a single CSV line. Kept for callers that already split lines;
 * implemented via the RFC 4180 tokenizer.
 */
export function parseCsvLine(line: string): string[] {
  const records = tokenizeCsv(line);
  if (records.length === 0) return [''];
  // A single line yields one record unless it contains an embedded newline
  // inside quotes (still one record) — join defensively in case of stray CR/LF.
  return records.length === 1 ? records[0] : records.flat();
}
