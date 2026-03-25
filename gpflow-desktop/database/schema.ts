import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      accurx_id TEXT NOT NULL UNIQUE,
      metadata TEXT DEFAULT '{}',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      source_file TEXT
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      type TEXT NOT NULL CHECK (type IN ('create', 'delete')),
      template_config TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS run_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      practice_id INTEGER NOT NULL REFERENCES practices(id),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'skipped', 'cancelled')),
      error_message TEXT,
      screenshot_path TEXT,
      dom_snapshot TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS page_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL CHECK (action IN ('login', 'create', 'delete')),
      selectors TEXT NOT NULL DEFAULT '{}',
      dom_hash TEXT NOT NULL,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_current INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS saved_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_name TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      individual INTEGER NOT NULL DEFAULT 1,
      batch INTEGER NOT NULL DEFAULT 0,
      allow_respond INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_cache (
      key_hash TEXT PRIMARY KEY,
      is_valid INTEGER NOT NULL,
      validated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_run_steps_run_id ON run_steps(run_id);
    CREATE INDEX IF NOT EXISTS idx_practices_accurx_id ON practices(accurx_id);
  `);
}
