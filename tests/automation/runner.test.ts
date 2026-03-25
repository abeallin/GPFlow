import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { upsertPractices } from '../../database/queries/practices';
import { createRun, getRunSteps, completeRun, getRuns } from '../../database/queries/runs';

describe('Run Flow Integration', () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
    upsertPractices(db, [
      { name: 'Practice A', accurx_id: '111' },
      { name: 'Practice B', accurx_id: '222' },
    ], 'test.csv');
  });

  afterEach(() => {
    db.close();
  });

  it('creates a run with steps for each practice', () => {
    const runId = createRun(db, 'create', {
      template_name: 'Test', message: 'Hello', individual: true, batch: false, allow_respond: false,
    }, [1, 2]);

    const steps = getRunSteps(db, runId);
    expect(steps).toHaveLength(2);
    expect(steps[0].status).toBe('pending');
  });

  it('completes a run and calculates summary', () => {
    const runId = createRun(db, 'create', {
      template_name: 'Test', message: 'Hello', individual: true, batch: false, allow_respond: false,
    }, [1, 2]);

    const steps = getRunSteps(db, runId);

    db.prepare('UPDATE run_steps SET status = ? WHERE id = ?').run('success', steps[0].id);
    db.prepare('UPDATE run_steps SET status = ? WHERE id = ?').run('failed', steps[1].id);

    completeRun(db, runId);

    const runs = getRuns(db);
    expect(runs[0].success_count).toBe(1);
    expect(runs[0].fail_count).toBe(1);
    expect(runs[0].status).toBe('failed');
  });
});
