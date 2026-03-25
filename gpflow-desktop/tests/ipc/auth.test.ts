import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '../../database/schema';
import { getCachedLicense, setCachedLicense } from '../../database/queries/license-cache';

describe('License Cache', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns null for uncached key', () => {
    expect(getCachedLicense(db, 'unknown-key')).toBeNull();
  });

  it('caches and retrieves a valid license', () => {
    setCachedLicense(db, 'my-key', true);
    expect(getCachedLicense(db, 'my-key')).toBe(true);
  });

  it('caches and retrieves an invalid license', () => {
    setCachedLicense(db, 'bad-key', false);
    expect(getCachedLicense(db, 'bad-key')).toBe(false);
  });
});
