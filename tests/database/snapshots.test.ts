import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { saveSnapshot, getCurrentSnapshot } from '../../database/queries/snapshots';

describe('Snapshots Queries', () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saveSnapshot inserts a snapshot and returns id', () => {
    const id = saveSnapshot(db, 'login', { btn: ['#login-btn'] }, 'abc123');
    expect(id).toBeGreaterThan(0);
  });

  it('getCurrentSnapshot returns the latest current snapshot', () => {
    saveSnapshot(db, 'create', { btn: ['#create-btn'] }, 'hash1');

    const snapshot = getCurrentSnapshot(db, 'create');
    expect(snapshot).toBeDefined();
    expect(snapshot.action).toBe('create');
    expect(snapshot.dom_hash).toBe('hash1');
    expect(snapshot.is_current).toBe(1);
    expect(JSON.parse(snapshot.selectors)).toEqual({ btn: ['#create-btn'] });
  });

  it('saveSnapshot marks previous snapshots for same action as not current', () => {
    saveSnapshot(db, 'login', { btn: ['#v1'] }, 'hash1');
    saveSnapshot(db, 'login', { btn: ['#v2'] }, 'hash2');

    const current = getCurrentSnapshot(db, 'login');
    expect(current.dom_hash).toBe('hash2');

    // Only one should be current
    const allCurrent = db
      .prepare('SELECT * FROM page_snapshots WHERE action = ? AND is_current = 1')
      .all('login');
    expect(allCurrent).toHaveLength(1);
  });

  it('saveSnapshot does not affect snapshots for different actions', () => {
    saveSnapshot(db, 'login', { btn: ['#login'] }, 'hashA');
    saveSnapshot(db, 'create', { btn: ['#create'] }, 'hashB');

    const loginSnap = getCurrentSnapshot(db, 'login');
    const createSnap = getCurrentSnapshot(db, 'create');

    expect(loginSnap).toBeDefined();
    expect(loginSnap.dom_hash).toBe('hashA');
    expect(createSnap).toBeDefined();
    expect(createSnap.dom_hash).toBe('hashB');
  });

  it('getCurrentSnapshot returns undefined for missing action', () => {
    const result = getCurrentSnapshot(db, 'delete');
    expect(result).toBeUndefined();
  });
});
