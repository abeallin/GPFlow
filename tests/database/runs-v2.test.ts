import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { createRun, getRunSteps, updateRunStep, completeRun, getRuns, getFailedPracticeIds } from '../../database/queries/runs';

const tpl = { template_name: 'T1' };
const practices = [
  { id: 101, name: 'Park Surgery', accurx_id: 'AAA' },
  { id: 102, name: 'Hill Practice', accurx_id: 'BBB' },
];

describe('run steps carry practice identity (no SQLite practices lookup needed)', () => {
  let db: Database.Database;
  beforeEach(async () => { db = await createTestDatabase(); createSchema(db); });
  afterEach(() => db.close());

  it('createRun stores practice name and accurx_id on each step', () => {
    const runId = createRun(db, 'create', tpl, practices);
    const steps = getRunSteps(db, runId);
    expect(steps.map((s) => [s.practice_id, s.practice_name, s.accurx_id])).toEqual([
      [101, 'Park Surgery', 'AAA'],
      [102, 'Hill Practice', 'BBB'],
    ]);
  });

  it('createSchema adds the new columns to a pre-existing run_steps table', async () => {
    const legacy = await createTestDatabase();
    legacy.exec(`
      CREATE TABLE runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
        type TEXT NOT NULL, template_config TEXT NOT NULL, total_count INTEGER NOT NULL DEFAULT 0, success_count INTEGER NOT NULL DEFAULT 0,
        fail_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'running', concurrency INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE run_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, practice_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', error_message TEXT, screenshot_path TEXT, dom_snapshot TEXT, completed_at TEXT, worker_index INTEGER);
    `);
    createSchema(legacy);
    const cols = (legacy.prepare('PRAGMA table_info(run_steps)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('practice_name');
    expect(cols).toContain('accurx_id');
    legacy.close();
  });
});

describe('completeRun status', () => {
  let db: Database.Database;
  beforeEach(async () => { db = await createTestDatabase(); createSchema(db); });
  afterEach(() => db.close());

  it('records cancelled when the run was cancelled, even if some steps succeeded', () => {
    const runId = createRun(db, 'create', tpl, practices);
    const steps = getRunSteps(db, runId);
    updateRunStep(db, steps[0].id, 'success');
    updateRunStep(db, steps[1].id, 'cancelled');
    completeRun(db, runId, { cancelled: true });
    expect(getRuns(db)[0].status).toBe('cancelled');
  });

  it('records completed (not cancelled) when every step was skipped', () => {
    const runId = createRun(db, 'create', tpl, practices);
    for (const s of getRunSteps(db, runId)) updateRunStep(db, s.id, 'skipped', 'Template already exists');
    completeRun(db, runId);
    expect(getRuns(db)[0].status).toBe('completed');
  });
});

describe('getFailedPracticeIds', () => {
  let db: Database.Database;
  beforeEach(async () => { db = await createTestDatabase(); createSchema(db); });
  afterEach(() => db.close());

  it('includes cancelled (never attempted) steps so they can be retried', () => {
    const runId = createRun(db, 'create', tpl, practices);
    const steps = getRunSteps(db, runId);
    updateRunStep(db, steps[0].id, 'failed', 'boom');
    updateRunStep(db, steps[1].id, 'cancelled');
    expect(getFailedPracticeIds(db, runId).sort()).toEqual([101, 102]);
  });
});
