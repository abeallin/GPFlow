import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvLine } from '@/lib/csv-parser';

describe('parseCsv', () => {
  it('keeps a quoted field containing a newline inside one row', () => {
    const text = 'accurx_id,name,address\nA1,"Alpha\nSurgery","1 High St, Town"\nA2,Beta,"2 Low St"\n';
    const { header, rows, errors } = parseCsv(text);
    expect(errors).toEqual([]);
    expect(header).toEqual(['accurx_id', 'name', 'address']);
    expect(rows).toEqual([
      ['A1', 'Alpha\nSurgery', '1 High St, Town'],
      ['A2', 'Beta', '2 Low St'],
    ]);
  });

  it('handles "" escapes, CRLF line endings, BOM, trailing newline and blank lines', () => {
    const text = '﻿accurx_id,name\r\nA1,"Say ""hi"""\r\n\r\nA2,"multi\r\nline"\r\n\r\n';
    const { header, rows, errors } = parseCsv(text);
    expect(errors).toEqual([]);
    expect(header).toEqual(['accurx_id', 'name']);
    expect(rows).toEqual([
      ['A1', 'Say "hi"'],
      ['A2', 'multi\r\nline'],
    ]);
  });

  it('reports duplicate header names as an error', () => {
    const { errors, header } = parseCsv('accurx_id,name,name\nA1,x,y\n');
    expect(header).toEqual(['accurx_id', 'name', 'name']);
    expect(errors.some((e) => /duplicate/i.test(e) && /name/.test(e))).toBe(true);
  });

  it('returns an empty header and no rows for empty input', () => {
    expect(parseCsv('')).toEqual({ header: [], rows: [], errors: [] });
    expect(parseCsv('\n\n')).toEqual({ header: [], rows: [], errors: [] });
  });
});

describe('parseCsvLine', () => {
  it('still parses a single line with quoted commas and escapes', () => {
    expect(parseCsvLine('a,"b,c","d ""e"""')).toEqual(['a', 'b,c', 'd "e"']);
  });

  it('trims unquoted whitespace', () => {
    expect(parseCsvLine(' a , b ')).toEqual(['a', 'b']);
  });
});
