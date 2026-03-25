import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { upsertPractices, getPractices, getPracticeById } from '../../database/queries/practices';

describe('Practices Queries', () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('upserts practices from parsed CSV rows', () => {
    const rows = [
      { name: 'Park Surgery', accurx_id: '12345', region: 'North' },
      { name: 'Oak Practice', accurx_id: '67890', region: 'South' },
    ];
    const result = upsertPractices(db, rows, 'data.csv');
    expect(result.inserted).toBe(2);

    const all = getPractices(db);
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Park Surgery');
    expect(JSON.parse(all[0].metadata as string)).toEqual({ region: 'North' });
  });

  it('upserts existing practice by accurx_id', () => {
    upsertPractices(db, [{ name: 'Park Surgery', accurx_id: '12345', region: 'North' }], 'v1.csv');
    upsertPractices(db, [{ name: 'Park Surgery Updated', accurx_id: '12345', region: 'West' }], 'v2.csv');

    const all = getPractices(db);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Park Surgery Updated');
    expect(all[0].source_file).toBe('v2.csv');
  });

  it('filters practices by column value', () => {
    upsertPractices(db, [
      { name: 'Park Surgery', accurx_id: '111', region: 'North' },
      { name: 'Oak Practice', accurx_id: '222', region: 'South' },
    ], 'data.csv');

    const filtered = getPractices(db, { name: 'Park' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].accurx_id).toBe('111');
  });

  it('gets a practice by id', () => {
    upsertPractices(db, [{ name: 'Park Surgery', accurx_id: '111' }], 'data.csv');
    const all = getPractices(db);
    const found = getPracticeById(db, all[0].id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Park Surgery');
  });
});
