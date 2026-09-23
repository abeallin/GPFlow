import type Database from 'better-sqlite3';

export interface RunPractice {
  id: number;
  name: string;
  accurx_id: string;
}

export interface RunStep {
  id: number;
  run_id: number;
  practice_id: number;
  practice_name: string | null;
  accurx_id: string | null;
  status: 'pending' | 'success' | 'failed' | 'skipped' | 'cancelled';
  error_message: string | null;
  screenshot_path: string | null;
  dom_snapshot: string | null;
  completed_at: string | null;
  worker_index: number | null;
}

export function createRun(
  db: Database.Database,
  type: 'create' | 'delete',
  templateConfig: Record<string, unknown>,
  practices: RunPractice[],
  concurrency = 1,
): number {
  const result = db.prepare(`
    INSERT INTO runs (type, template_config, total_count, concurrency)
    VALUES (?, ?, ?, ?)
  `).run(type, JSON.stringify(templateConfig), practices.length, concurrency);

  const runId = result.lastInsertRowid as number;

  const insertStep = db.prepare(
    'INSERT INTO run_steps (run_id, practice_id, practice_name, accurx_id) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    for (const p of practices) {
      insertStep.run(runId, p.id, p.name, p.accurx_id);
    }
  });
  tx();

  return runId;
}

export function updateRunStep(
  db: Database.Database,
  stepId: number,
  status: string,
  errorMessage?: string,
  screenshotPath?: string,
  domSnapshot?: string,
  workerIndex?: number,
): void {
  db.prepare(`
    UPDATE run_steps SET
      status = ?,
      error_message = ?,
      screenshot_path = ?,
      dom_snapshot = ?,
      worker_index = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(status, errorMessage || null, screenshotPath || null, domSnapshot || null, workerIndex ?? null, stepId);
}

/** Mark every step of a run that is still pending with the given terminal status. */
export function finalisePendingSteps(
  db: Database.Database,
  runId: number,
  status: 'failed' | 'cancelled',
  errorMessage?: string,
): number {
  const result = db.prepare(`
    UPDATE run_steps SET status = ?, error_message = ?, completed_at = datetime('now')
    WHERE run_id = ? AND status = 'pending'
  `).run(status, errorMessage || null, runId);
  return result.changes;
}

export function completeRun(
  db: Database.Database,
  runId: number,
  opts: { cancelled?: boolean } = {},
): void {
  const counts = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as fail_count
    FROM run_steps WHERE run_id = ?
  `).get(runId) as { success_count: number; fail_count: number };

  // cancelled: the user (or a circuit breaker) stopped the run.
  // failed: nothing succeeded and at least one step failed.
  // completed: everything else (including "all already existed").
  const status = opts.cancelled
    ? 'cancelled'
    : counts.success_count === 0 && counts.fail_count > 0
      ? 'failed'
      : 'completed';

  db.prepare(`
    UPDATE runs SET
      completed_at = datetime('now'),
      success_count = ?,
      fail_count = ?,
      status = ?
    WHERE id = ?
  `).run(counts.success_count, counts.fail_count, status, runId);
}

export function getRuns(db: Database.Database, limit = 50, offset = 0): any[] {
  return db.prepare('SELECT * FROM runs ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

export function getRunSteps(db: Database.Database, runId: number): RunStep[] {
  return db.prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY id')
    .all(runId) as RunStep[];
}

/** Practice ids whose step did not succeed and was not skipped: failed, or never attempted (cancelled). */
export function getFailedPracticeIds(db: Database.Database, runId: number): number[] {
  const rows = db.prepare(
    "SELECT practice_id FROM run_steps WHERE run_id = ? AND status IN ('failed', 'cancelled')"
  ).all(runId) as { practice_id: number }[];
  return rows.map((r) => r.practice_id);
}
