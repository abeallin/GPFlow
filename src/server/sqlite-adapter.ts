import initSqlJs from 'sql.js';
import type Database from 'better-sqlite3';
import fs from 'fs';

type SqlJsDatabase = any;
type BindParams = any;
type Row = Record<string, unknown>;

function convertNamedParams(
  sql: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params[0])) {
      converted[`$${key}`] = value;
    }
    const convertedSql = sql.replace(/@(\w+)/g, '$$$1');
    return { sql: convertedSql, params: [converted] };
  }
  return { sql, params };
}

function resolveBindings(params: unknown[]): BindParams {
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    return params[0] as BindParams;
  }
  return params as BindParams;
}

class StatementAdapter {
  private db: SqlJsDatabase;
  private sql: string;
  private onMutate?: () => void;

  constructor(db: SqlJsDatabase, sql: string, onMutate?: () => void) {
    this.db = db;
    this.sql = sql;
    this.onMutate = onMutate;
  }

  run(...params: unknown[]): { lastInsertRowid: number; changes: number } {
    const { sql, params: converted } = convertNamedParams(this.sql, params);
    const bindings = resolveBindings(converted);

    this.db.run(sql, bindings);

    const rowIdResult = this.db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid =
      rowIdResult.length > 0 ? (rowIdResult[0].values[0][0] as number) : 0;

    const changesResult = this.db.exec('SELECT changes() as c');
    const changes =
      changesResult.length > 0 ? (changesResult[0].values[0][0] as number) : 0;

    if (this.onMutate) this.onMutate();

    return { lastInsertRowid, changes };
  }

  get(...params: unknown[]): Row | undefined {
    const { sql, params: converted } = convertNamedParams(this.sql, params);
    const bindings = resolveBindings(converted);

    const stmt = this.db.prepare(sql);
    stmt.bind(bindings);

    if (stmt.step()) {
      const row = stmt.getAsObject() as Row;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params: unknown[]): Row[] {
    const { sql, params: converted } = convertNamedParams(this.sql, params);
    const bindings = resolveBindings(converted);

    const results: Row[] = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(bindings);

    while (stmt.step()) {
      results.push(stmt.getAsObject() as Row);
    }
    stmt.free();
    return results;
  }
}

export class DatabaseAdapter {
  private db: SqlJsDatabase;
  private filePath?: string;
  private inTransaction = false;

  constructor(db: SqlJsDatabase, filePath?: string) {
    this.db = db;
    this.filePath = filePath;
  }

  private persist() {
    if (this.inTransaction) return;
    if (this.filePath && this.filePath !== ':memory:') {
      try {
        const data = this.db.export();
        fs.writeFileSync(this.filePath, Buffer.from(data));
      } catch (err) {
        console.error('Failed to persist database file:', err);
      }
    }
  }

  exec(sql: string): void {
    this.db.run(sql);
    this.persist();
  }

  prepare(sql: string): StatementAdapter {
    return new StatementAdapter(this.db, sql, () => this.persist());
  }

  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      if (this.inTransaction) {
        return fn(...args);
      }
      this.inTransaction = true;
      this.db.run('BEGIN');
      try {
        const result = fn(...args);
        this.db.run('COMMIT');
        this.inTransaction = false;
        this.persist();
        return result;
      } catch (err) {
        this.inTransaction = false;
        try {
          this.db.run('ROLLBACK');
        } catch {
          // Transaction already closed or rolled back
        }
        this.persist();
        throw err;
      }
    };
  }

  pragma(_str: string): void {}

  close(): void {
    this.persist();
    this.db.close();
  }
}

import { createRequire } from 'node:module';

export async function createSqlJsDatabase(filePath?: string): Promise<Database.Database> {
  const req = createRequire(process.cwd() + '/package.json');
  const wasmPath = req.resolve('sql.js/dist/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);

  const SQL = await initSqlJs({ wasmBinary });
  let fileBuffer: Buffer | null = null;
  if (filePath && filePath !== ':memory:' && fs.existsSync(filePath)) {
    try {
      fileBuffer = fs.readFileSync(filePath);
    } catch {
      fileBuffer = null;
    }
  }
  const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  return new DatabaseAdapter(db, filePath) as unknown as Database.Database;
}
