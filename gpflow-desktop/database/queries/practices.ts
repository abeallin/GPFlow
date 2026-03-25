import type Database from 'better-sqlite3';

const FIXED_COLUMNS = ['name', 'accurx_id'];

export interface Practice {
  id: number;
  name: string;
  accurx_id: string;
  metadata: string;
  imported_at: string;
  source_file: string;
}

export function upsertPractices(
  db: Database.Database,
  rows: Record<string, string>[],
  sourceFile: string,
): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;

  const upsert = db.prepare(`
    INSERT INTO practices (name, accurx_id, metadata, source_file)
    VALUES (@name, @accurx_id, @metadata, @source_file)
    ON CONFLICT (accurx_id) DO UPDATE SET
      name = @name,
      metadata = @metadata,
      source_file = @source_file,
      imported_at = datetime('now')
  `);

  const tx = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!FIXED_COLUMNS.includes(key)) {
          metadata[key] = value;
        }
      }

      const existing = db
        .prepare('SELECT id FROM practices WHERE accurx_id = ?')
        .get(row.accurx_id);

      upsert.run({
        name: row.name || '',
        accurx_id: row.accurx_id,
        metadata: JSON.stringify(metadata),
        source_file: sourceFile,
      });

      if (existing) updated++;
      else inserted++;
    }
  });

  tx(rows);
  return { inserted, updated };
}

export function getPractices(
  db: Database.Database,
  filters?: Record<string, string>,
  sort?: { field: string; asc: boolean },
): Practice[] {
  let query = 'SELECT * FROM practices';
  const params: string[] = [];

  const ALLOWED_COLUMNS = ['name', 'accurx_id', 'source_file'];

  if (filters && Object.keys(filters).length > 0) {
    const clauses = Object.entries(filters)
      .filter(([key]) => ALLOWED_COLUMNS.includes(key))
      .map(([key, value]) => {
        params.push(`${value}%`);
        return `${key} LIKE ?`;
      });
    if (clauses.length > 0) {
      query += ` WHERE ${clauses.join(' AND ')}`;
    }
  }

  if (sort && ALLOWED_COLUMNS.includes(sort.field)) {
    query += ` ORDER BY ${sort.field} ${sort.asc ? 'ASC' : 'DESC'}`;
  }

  return db.prepare(query).all(...params) as Practice[];
}

export function getPracticeById(
  db: Database.Database,
  id: number,
): Practice | undefined {
  return db.prepare('SELECT * FROM practices WHERE id = ?').get(id) as Practice | undefined;
}
