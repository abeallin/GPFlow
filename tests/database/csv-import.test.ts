import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { importCsv } from '../../database/csv-import';
import { getPractices } from '../../database/queries/practices';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CSV Import', () => {
  let db: any;
  let tmpDir: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpflow-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('imports a valid CSV with accurx_id column', () => {
    const csvPath = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(csvPath, 'name,accurx_id,region\nPark Surgery,12345,North\nOak Practice,67890,South\n');

    const result = importCsv(db, csvPath);
    expect(result.rowCount).toBe(2);
    expect(result.errors).toHaveLength(0);

    const practices = getPractices(db);
    expect(practices).toHaveLength(2);
  });

  it('rejects CSV without accurx_id column', () => {
    const csvPath = path.join(tmpDir, 'bad.csv');
    fs.writeFileSync(csvPath, 'name,region\nPark Surgery,North\n');

    const result = importCsv(db, csvPath);
    expect(result.rowCount).toBe(0);
    expect(result.errors).toContain('CSV must contain an "accurx_id" or "Accurx_Id" column');
  });

  it('skips rows with empty accurx_id', () => {
    const csvPath = path.join(tmpDir, 'partial.csv');
    fs.writeFileSync(csvPath, 'name,accurx_id\nPark Surgery,12345\nBad Row,\n');

    const result = importCsv(db, csvPath);
    expect(result.rowCount).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});

describe('CSV Import — RFC 4180 edge cases', () => {
  let db: any;
  let tmpDir: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpflow-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('keeps a quoted field that contains a newline inside one row', () => {
    const csvPath = path.join(tmpDir, 'addr.csv');
    fs.writeFileSync(csvPath, 'name,accurx_id,address\r\n"Park Surgery",111,"1 High St\r\nLeeds"\r\nOak Practice,222,"2 Low St"\r\n');

    const result = importCsv(db, csvPath);

    expect(result.errors).toHaveLength(0);
    expect(result.rowCount).toBe(2);
    const park = getPractices(db).find((p: any) => p.accurx_id === '111')!;
    expect(JSON.parse(park.metadata).address).toBe('1 High St\r\nLeeds');
  });

  it('rejects duplicate header names instead of silently overwriting a column', () => {
    const csvPath = path.join(tmpDir, 'dup.csv');
    fs.writeFileSync(csvPath, 'name,accurx_id,name\nPark,111,Other\n');

    const result = importCsv(db, csvPath);

    expect(result.rowCount).toBe(0);
    expect(result.errors[0]).toMatch(/duplicate/i);
  });
});
