import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/sqlite-adapter';
import { createSchema } from '../../database/schema';
import { upsertPractices } from '../../database/queries/practices';
import {
  createRun,
  getRunSteps,
  updateRunStep,
  completeRun,
  getRuns,
  getFailedPracticeIds,
} from '../../database/queries/runs';

describe('Runs Queries', () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    createSchema(db);
    upsertPractices(db, [
      { name: 'Practice A', accurx_id: 'AAA' },
      { name: 'Practice B', accurx_id: 'BBB' },
      { name: 'Practice C', accurx_id: 'CCC' },
    ], 'test.csv');
  });

  afterEach(() => {
    db.close();
  });

  it('createRun inserts a run and its steps', () => {
    const runId = createRun(db, 'create', { template_name: 'T1' }, [1, 2, 3]);
    expect(runId).toBeGreaterThan(0);

    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
    expect(run.type).toBe('create');
    expect(run.total_count).toBe(3);
    expect(run.status).toBe('running');

    const steps = getRunSteps(db, runId);
    expect(steps).toHaveLength(3);
    expect(steps.map((s: any) => s.practice_id)).toEqual([1, 2, 3]);
  });

  it('getRunSteps returns steps ordered by id', () => {
    const runId = createRun(db, 'delete', { template_name: 'T2' }, [3, 1]);
    const steps = getRunSteps(db, runId);
    expect(steps).toHaveLength(2);
    expect(steps[0].id).toBeLessThan(steps[1].id);
  });

  it('updateRunStep sets status and optional fields', () => {
    const runId = createRun(db, 'create', { template_name: 'T1' }, [1]);
    const steps = getRunSteps(db, runId);
    const stepId = steps[0].id;

    updateRunStep(db, stepId, 'failed', 'Element not found', '/screenshots/1.png', '<html></html>');

    const updated = db.prepare('SELECT * FROM run_steps WHERE id = ?').get(stepId);
    expect(updated.status).toBe('failed');
    expect(updated.error_message).toBe('Element not found');
    expect(updated.screenshot_path).toBe('/screenshots/1.png');
    expect(updated.dom_snapshot).toBe('<html></html>');
    expect(updated.completed_at).toBeTruthy();
  });

  it('updateRunStep sets null for missing optional fields', () => {
    const runId = createRun(db, 'create', { template_name: 'T1' }, [1]);
    const steps = getRunSteps(db, runId);

    updateRunStep(db, steps[0].id, 'success');

    const updated = db.prepare('SELECT * FROM run_steps WHERE id = ?').get(steps[0].id);
    expect(updated.status).toBe('success');
    expect(updated.error_message).toBeNull();
    expect(updated.screenshot_path).toBeNull();
  });

  it('completeRun marks run as completed when all succeed', () => {
    const runId = createRun(db, 'create', { template_name: 'T1' }, [1, 2]);
    const steps = getRunSteps(db, runId);

    updateRunStep(db, steps[0].id, 'success');
    updateRunStep(db, steps[1].id, 'success');

    completeRun(db, runId);

    const runs = getRuns(db);
    expect(runs[0].status).toBe('completed');
    expect(runs[0].success_count).toBe(2);
    expect(runs[0].fail_count).toBe(0);
    expect(runs[0].completed_at).toBeTruthy();
  });

  it('completeRun marks run as failed when any step fails', () => {
    const runId = createRun(db, 'create', { template_name: 'T1' }, [1, 2]);
    const steps = getRunSteps(db, runId);

    updateRunStep(db, steps[0].id, 'success');
    updateRunStep(db, steps[1].id, 'failed', 'timeout');

    completeRun(db, runId);

    const runs = getRuns(db);
    expect(runs[0].status).toBe('failed');
    expect(runs[0].fail_count).toBe(1);
  });

  it('getRuns returns runs ordered by started_at DESC with limit/offset', () => {
    createRun(db, 'create', { template_name: 'T1' }, [1]);
    createRun(db, 'delete', { template_name: 'T2' }, [2]);
    createRun(db, 'create', { template_name: 'T3' }, [3]);

    const all = getRuns(db);
    expect(all).toHaveLength(3);

    const limited = getRuns(db, 2, 0);
    expect(limited).toHaveLength(2);

    const offset = getRuns(db, 10, 2);
    expect(offset).toHaveLength(1);
  });

  it('getFailedPracticeIds returns only failed practice ids', () => {
    const runId = createRun(db, 'create', { template_name: 'T1' }, [1, 2, 3]);
    const steps = getRunSteps(db, runId);

    updateRunStep(db, steps[0].id, 'success');
    updateRunStep(db, steps[1].id, 'failed', 'err');
    updateRunStep(db, steps[2].id, 'failed', 'err');

    const failedIds = getFailedPracticeIds(db, runId);
    expect(failedIds).toHaveLength(2);
    expect(failedIds).toContain(2);
    expect(failedIds).toContain(3);
  });
});
