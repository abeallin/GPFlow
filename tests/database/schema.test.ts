import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';

describe('Database Schema', () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('creates all required tables', () => {
    createSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row: any) => row.name);

    expect(tables).toContain('practices');
    expect(tables).toContain('runs');
    expect(tables).toContain('run_steps');
    expect(tables).toContain('page_snapshots');
    expect(tables).toContain('saved_templates');
    expect(tables).toContain('license_cache');
  });

  it('is idempotent — running twice does not error', () => {
    createSchema(db);
    expect(() => createSchema(db)).not.toThrow();
  });
});
