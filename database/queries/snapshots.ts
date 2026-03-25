import type Database from 'better-sqlite3';

export function saveSnapshot(
  db: Database.Database,
  action: string,
  selectors: Record<string, string[]>,
  domHash: string,
): number {
  db.prepare('UPDATE page_snapshots SET is_current = 0 WHERE action = ?').run(action);

  const result = db.prepare(`
    INSERT INTO page_snapshots (action, selectors, dom_hash, is_current)
    VALUES (?, ?, ?, 1)
  `).run(action, JSON.stringify(selectors), domHash);

  return result.lastInsertRowid as number;
}

export function getCurrentSnapshot(
  db: Database.Database,
  action: string,
): any | undefined {
  return db.prepare(
    'SELECT * FROM page_snapshots WHERE action = ? AND is_current = 1'
  ).get(action);
}
