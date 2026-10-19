import path from 'path';
import type Database from 'better-sqlite3';
import { createSchema } from '../../database/schema';
import { getRuns, getFailedPracticeIds } from '../../database/queries/runs';
import { AutomationRunner, type RunConfig, type EventSink } from '../../automation/runner';
import { createAutomationController, type ActiveRun } from '../../electron/ipc/automation-controller';
import { createSqlJsDatabase } from './sqlite-adapter';

export type EventListener = (channel: string, payload: unknown) => void;

class AutomationService {
  private db: Database.Database | null = null;
  private listeners = new Set<EventListener>();
  private controller: ReturnType<typeof createAutomationController> | null = null;
  private initPromise: Promise<void> | null = null;

  private async ensureInit(): Promise<{
    db: Database.Database;
    controller: ReturnType<typeof createAutomationController>;
  }> {
    if (this.db && this.controller) {
      return { db: this.db, controller: this.controller };
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const dbDir = process.env.DATA_DIR || process.cwd();
        const dbPath = path.join(dbDir, 'gpflow.db');

        let dbInstance: Database.Database;
        try {
          const BetterSqlite = (await import('better-sqlite3')).default;
          dbInstance = new BetterSqlite(dbPath);
          dbInstance.pragma('journal_mode = WAL');
          dbInstance.pragma('foreign_keys = ON');
        } catch {
          // If native better-sqlite3 ABI differs (e.g. built for Electron), fallback seamlessly to sql.js
          dbInstance = await createSqlJsDatabase(dbPath);
        }

        createSchema(dbInstance);
        this.db = dbInstance;

        const sink: EventSink = {
          send: (channel: string, payload: unknown) => {
            for (const listener of this.listeners) {
              try {
                listener(channel, payload);
              } catch (err) {
                console.error('Error dispatching event to listener:', err);
              }
            }
          },
        };

        const makeRunner = () =>
          new AutomationRunner(sink, this.db!, {
            screenshotDir: path.join(dbDir, 'screenshots'),
          });

        this.controller = createAutomationController({
          sink,
          makeRunner,
          getFailedPracticeIds: (runId) => getFailedPracticeIds(this.db!, runId),
        });
      })();
    }

    await this.initPromise;
    return { db: this.db!, controller: this.controller! };
  }

  public addListener(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async startRun(config: RunConfig) {
    const { controller } = await this.ensureInit();
    return controller.start(config);
  }

  public async stopRun(runId: number) {
    const { controller } = await this.ensureInit();
    return controller.stop(runId);
  }

  public async stopAllRuns() {
    const { controller } = await this.ensureInit();
    return controller.stopAll();
  }

  public async getActiveRuns(): Promise<ActiveRun[]> {
    const { controller } = await this.ensureInit();
    return controller.activeRuns();
  }

  public async retryFailed(runId: number) {
    const { controller, db } = await this.ensureInit();
    const result = controller.retryFailed(runId);
    const runRow = db.prepare('SELECT type, template_config FROM runs WHERE id = ?').get(runId) as
      | { type: 'create' | 'delete'; template_config: string }
      | undefined;
    return {
      ...result,
      type: runRow?.type || 'create',
      templateConfig: runRow?.template_config ? JSON.parse(runRow.template_config) : undefined,
    };
  }

  public async getRuns(limit = 50, offset = 0) {
    const { db } = await this.ensureInit();
    const rows = getRuns(db, limit, offset);
    return rows.map((r) => ({
      ...r,
      template_config:
        typeof r.template_config === 'string'
          ? JSON.parse(r.template_config)
          : r.template_config,
    }));
  }
}

const globalForAutomation = globalThis as unknown as {
  automationService?: AutomationService;
};

export const automationService =
  globalForAutomation.automationService ?? new AutomationService();

if (process.env.NODE_ENV !== 'production') {
  globalForAutomation.automationService = automationService;
}
