import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

/**
 * Wraps a sql.js Database to match the better-sqlite3 API surface
 * used throughout the GPFlow codebase.
 */
export class DatabaseAdapter {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  exec(sql: string): void {
    this.db.run(sql);
  }

  prepare(sql: string): StatementAdapter {
    return new StatementAdapter(this.db, sql);
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    const self = this;
    const wrapper = ((...args: any[]) => {
      self.db.run('BEGIN');
      try {
        const result = fn(...args);
        self.db.run('COMMIT');
        return result;
      } catch (err) {
        self.db.run('ROLLBACK');
        throw err;
      }
    }) as unknown as T;
    return wrapper;
  }

  pragma(_str: string): void {
    // no-op for tests — sql.js doesn't support pragmas the same way
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Convert better-sqlite3 @name param syntax to sql.js $name syntax in SQL,
 * and convert param objects from {name: val} to {$name: val}.
 */
function convertNamedParams(
  sql: string,
  params: any[],
): { sql: string; params: any[] } {
  // If single object param with named params, convert @name -> $name
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(params[0])) {
      converted[`$${key}`] = value;
    }
    const convertedSql = sql.replace(/@(\w+)/g, '$$$1');
    return { sql: convertedSql, params: [converted] };
  }
  return { sql, params };
}

/**
 * Flatten params: if a single object with $keys, return it as-is for sql.js binding.
 * Otherwise return the positional array.
 */
function resolveBindings(params: any[]): any {
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    return params[0];
  }
  return params;
}

class StatementAdapter {
  private db: SqlJsDatabase;
  private sql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  run(...params: any[]): { lastInsertRowid: number; changes: number } {
    const { sql, params: converted } = convertNamedParams(this.sql, params);
    const bindings = resolveBindings(converted);

    this.db.run(sql, bindings);

    // Get lastInsertRowid
    const rowIdResult = this.db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid =
      rowIdResult.length > 0 ? (rowIdResult[0].values[0][0] as number) : 0;

    // Get changes
    const changesResult = this.db.exec('SELECT changes() as c');
    const changes =
      changesResult.length > 0 ? (changesResult[0].values[0][0] as number) : 0;

    return { lastInsertRowid, changes };
  }

  get(...params: any[]): any | undefined {
    const { sql, params: converted } = convertNamedParams(this.sql, params);
    const bindings = resolveBindings(converted);

    const stmt = this.db.prepare(sql);
    stmt.bind(bindings);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params: any[]): any[] {
    const { sql, params: converted } = convertNamedParams(this.sql, params);
    const bindings = resolveBindings(converted);

    const results: any[] = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(bindings);

    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

/**
 * Creates an in-memory test database wrapped with the better-sqlite3 API adapter.
 */
export async function createTestDatabase(): Promise<DatabaseAdapter> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  return new DatabaseAdapter(db);
}
