import type Database from 'better-sqlite3';

export function saveSnapshot(
  db: Database.Database,
  action: string,
  selectors: Record<string, string[]>,
  domHash: string,
): number {
  // Atomic: both operations in a single transaction
  const tx = db.transaction(() => {
    db.prepare('UPDATE page_snapshots SET is_current = 0 WHERE action = ?').run(action);
    const result = db.prepare(`
      INSERT INTO page_snapshots (action, selectors, dom_hash, is_current)
      VALUES (?, ?, ?, 1)
    `).run(action, JSON.stringify(selectors), domHash);
    return result.lastInsertRowid as number;
  });
  return tx();
}

/** A row of `page_snapshots` as stored: `selectors` is JSON text and `is_current` is 0/1. */
export interface SnapshotRow {
  id: number;
  action: string;
  selectors: string;
  dom_hash: string;
  captured_at: string;
  is_current: number;
}

export function getCurrentSnapshot(
  db: Database.Database,
  action: string,
): SnapshotRow | undefined {
  return db.prepare(
    'SELECT * FROM page_snapshots WHERE action = ? AND is_current = 1'
  ).get(action) as SnapshotRow | undefined;
}
