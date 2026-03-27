import type Database from 'better-sqlite3';

export function createRun(
  db: Database.Database,
  type: 'create' | 'delete',
  templateConfig: Record<string, unknown>,
  practiceIds: number[],
  concurrency = 1,
): number {
  const result = db.prepare(`
    INSERT INTO runs (type, template_config, total_count, concurrency)
    VALUES (?, ?, ?, ?)
  `).run(type, JSON.stringify(templateConfig), practiceIds.length, concurrency);

  const runId = result.lastInsertRowid as number;

  const insertStep = db.prepare(
    'INSERT INTO run_steps (run_id, practice_id) VALUES (?, ?)'
  );

  const tx = db.transaction(() => {
    for (const practiceId of practiceIds) {
      insertStep.run(runId, practiceId);
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

export function completeRun(db: Database.Database, runId: number): void {
  const counts = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as fail_count
    FROM run_steps WHERE run_id = ?
  `).get(runId) as { success_count: number; fail_count: number };

  // "completed" if any succeeded, "failed" only if ALL failed, "cancelled" if none ran
  const status = counts.success_count > 0 ? 'completed' : counts.fail_count > 0 ? 'failed' : 'cancelled';

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
  return db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

export function getRunSteps(db: Database.Database, runId: number): any[] {
  return db.prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY id')
    .all(runId);
}

export function getFailedPracticeIds(db: Database.Database, runId: number): number[] {
  const rows = db.prepare(
    'SELECT practice_id FROM run_steps WHERE run_id = ? AND status = ?'
  ).all(runId, 'failed') as { practice_id: number }[];
  return rows.map((r) => r.practice_id);
}
