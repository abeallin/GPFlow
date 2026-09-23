import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import type Database from 'better-sqlite3';
import { loginToAccurx, waitFor2faCompletion, type LoginResult } from './actions/login';
import { createTemplate, type CreateTemplateResult, type TemplateConfig } from './actions/create-template';
import { deleteTemplate, type DeleteTemplateResult } from './actions/delete-template';
import { captureScreenshot, type ScreenshotMode } from './screenshots';
import { hashDom } from './change-detection';
import {
  createRun, updateRunStep, completeRun, getRunSteps, finalisePendingSteps, type RunPractice, type RunStep,
} from '../database/queries/runs';
import { saveSnapshot, getCurrentSnapshot } from '../database/queries/snapshots';
import { CancellationToken, CancellationError } from './cancellation-token';
import { WorkQueue } from './work-queue';
import path from 'path';

const BASE_TEMPLATE_URL = 'https://web.accurx.com/w/{id}/settings/templates?tab=OrganisationTemplates';

export interface RunConfig {
  type: 'create' | 'delete';
  templateConfig: TemplateConfig;
  practices: RunPractice[];
  screenshotMode: ScreenshotMode;
  credentials: { username: string; password: string };
  concurrency?: number;
  accountLabel?: string;
}

/** Where the runner pushes events; in production this is `mainWindow.webContents`. */
export interface EventSink {
  send: (channel: string, payload: unknown) => void;
}

/** Everything with a side effect is injectable so the runner can be tested without a browser. */
export interface RunnerDeps {
  launchBrowser: () => Promise<Browser>;
  login: (page: Page, username: string, password: string) => Promise<LoginResult>;
  waitFor2fa: (page: Page) => Promise<boolean>;
  createTemplate: (page: Page, cfg: TemplateConfig) => Promise<CreateTemplateResult>;
  deleteTemplate: (page: Page, name: string) => Promise<DeleteTemplateResult>;
  captureScreenshot: (page: Page, basePath: string, runId: number, stepIndex: number, label: string) => Promise<string>;
  powerSaveBlocker: { start: () => number | null; stop: (id: number) => void } | null;
  screenshotDir: string;
  retryDelayMs: number;
  /** Abort the run after this many failures in a row (e.g. expired session). */
  maxConsecutiveFailures: number;
}

export class RunAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunAbortedError';
  }
}

function defaultDeps(): RunnerDeps {
  let powerSaveBlocker: RunnerDeps['powerSaveBlocker'] = null;
  let screenshotDir = path.join(process.cwd(), 'screenshots');
  try {
    // Only available inside the Electron main process.
    const electron = require('electron');
    powerSaveBlocker = {
      start: () => electron.powerSaveBlocker.start('prevent-display-sleep'),
      stop: (id: number) => electron.powerSaveBlocker.stop(id),
    };
    screenshotDir = path.join(electron.app.getPath('userData'), 'screenshots');
  } catch { /* not in electron */ }

  return {
    launchBrowser: () => chromium.launch({ headless: false }),
    login: loginToAccurx,
    waitFor2fa: waitFor2faCompletion,
    createTemplate,
    deleteTemplate,
    captureScreenshot,
    powerSaveBlocker,
    screenshotDir,
    retryDelayMs: 3000,
    maxConsecutiveFailures: 5,
  };
}

export function validateRunConfig(config: RunConfig): void {
  if (config.type !== 'create' && config.type !== 'delete') {
    throw new Error(`Invalid run type: ${String(config.type)}`);
  }
  if (!Array.isArray(config.practices) || config.practices.length === 0) {
    throw new Error('At least one practice is required');
  }
  for (const p of config.practices) {
    if (typeof p?.id !== 'number' || typeof p.accurx_id !== 'string' || !p.accurx_id) {
      throw new Error('Each practice needs a numeric id and an accurx_id');
    }
  }
  if (!config.credentials?.username || !config.credentials?.password) {
    throw new Error('Credentials (username and password) are required');
  }
  if (!config.templateConfig?.template_name) {
    throw new Error('A template name is required');
  }
}

export class AutomationRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Page[] = [];
  private token = new CancellationToken();
  private powerSaveId: number | null = null;
  private readonly sink: EventSink;
  private readonly db: Database.Database;
  private readonly deps: RunnerDeps;
  public currentRunId = 0;
  private completedCount = 0;
  private consecutiveFailures = 0;
  private abortReason: string | null = null;
  private changeChecked = false;

  constructor(sink: EventSink, db: Database.Database, deps: Partial<RunnerDeps> = {}) {
    this.sink = sink;
    this.db = db;
    this.deps = { ...defaultDeps(), ...deps };
  }

  /** Convenience for callers that want to wait for the whole run. */
  async run(config: RunConfig): Promise<number> {
    return this.launch(config).completion;
  }

  /**
   * Validate, create the run record synchronously, and start executing in the background.
   * `runId` is available immediately; `completion` settles when the run has finished.
   * `completion` rejects with the fatal error (login failure, abort) — step-level failures
   * are recorded on the steps and do not reject.
   */
  launch(config: RunConfig): { runId: number; completion: Promise<number> } {
    validateRunConfig(config);

    this.token = new CancellationToken();
    this.completedCount = 0;
    this.consecutiveFailures = 0;
    this.abortReason = null;
    this.changeChecked = false;

    const concurrency = Math.max(1, Math.min(config.concurrency ?? 4, 15));
    const runId = createRun(this.db, config.type, config.templateConfig as any, config.practices, concurrency);
    this.currentRunId = runId;

    const completion = this.execute(config, runId, concurrency);
    return { runId, completion };
  }

  private label(config: RunConfig): string {
    return config.accountLabel || config.credentials.username;
  }

  private async execute(config: RunConfig, runId: number, concurrency: number): Promise<number> {
    const steps = getRunSteps(this.db, runId);
    const accountLabel = this.label(config);

    if (this.deps.powerSaveBlocker) {
      try { this.powerSaveId = this.deps.powerSaveBlocker.start(); } catch { this.powerSaveId = null; }
    }

    try {
      this.browser = await this.token.race(this.deps.launchBrowser());
      this.context = await this.token.race(this.browser.newContext());

      // Login on a dedicated page — all pages in the context share cookies
      const loginPage = await this.token.race(this.context.newPage());
      const loginResult = await this.token.race(
        this.deps.login(loginPage, config.credentials.username, config.credentials.password),
      );

      if (loginResult.requires2fa) {
        this.sink.send('automation:2fa-required', { runId, accountLabel });
        const completed = await this.token.race(this.deps.waitFor2fa(loginPage));
        if (!completed) {
          throw new Error('2FA timeout — user did not complete within 5 minutes');
        }
      } else if (!loginResult.success) {
        throw new Error(`Login failed: ${loginResult.error ?? 'unknown error'}`);
      }

      await loginPage.close().catch(() => {});

      const effectiveConcurrency = Math.min(concurrency, steps.length);
      this.pages = await this.token.race(Promise.all(
        Array.from({ length: effectiveConcurrency }, () => this.context!.newPage()),
      ));

      const queue = new WorkQueue<RunStep>({
        items: steps,
        concurrency: effectiveConcurrency,
        token: this.token,
        worker: (step, workerIndex) => this.processStep(step, workerIndex, config, runId, steps.length),
      });

      await queue.run();

      if (this.abortReason) {
        finalisePendingSteps(this.db, runId, 'cancelled', this.abortReason);
        completeRun(this.db, runId, { cancelled: true });
        this.sendComplete(runId, accountLabel);
        throw new RunAbortedError(this.abortReason);
      }

      if (this.token.isCancelled) {
        finalisePendingSteps(this.db, runId, 'cancelled', 'Cancelled by user');
        completeRun(this.db, runId, { cancelled: true });
      } else {
        completeRun(this.db, runId);
      }

      this.sendComplete(runId, accountLabel);
      return runId;
    } catch (error) {
      if (error instanceof RunAbortedError) throw error;

      if (error instanceof CancellationError) {
        finalisePendingSteps(this.db, runId, 'cancelled', 'Cancelled by user');
        completeRun(this.db, runId, { cancelled: true });
        this.sendComplete(runId, accountLabel);
        return runId;
      }

      // Fatal (login, browser launch, 2FA): every untouched step is retryable.
      const message = error instanceof Error ? error.message : String(error);
      finalisePendingSteps(this.db, runId, 'failed', message);
      completeRun(this.db, runId);
      this.db.prepare(`UPDATE runs SET status = 'failed' WHERE id = ?`).run(runId);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private sendComplete(runId: number, accountLabel: string): void {
    const finalRun = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
    this.sink.send('automation:complete', {
      runId,
      accountLabel,
      status: finalRun.status,
      summary: {
        totalCount: finalRun.total_count,
        successCount: finalRun.success_count,
        failCount: finalRun.fail_count,
        duration: new Date(finalRun.completed_at).getTime() - new Date(finalRun.started_at).getTime(),
      },
    });
  }

  private async processStep(step: RunStep, workerIndex: number, config: RunConfig, runId: number, total: number): Promise<void> {
    this.token.throwIfCancelled();
    if (this.abortReason) throw new CancellationError();

    const practice = {
      id: step.practice_id,
      name: step.practice_name || step.accurx_id || String(step.practice_id),
      accurx_id: step.accurx_id || '',
    };
    if (!practice.accurx_id) {
      updateRunStep(this.db, step.id, 'skipped', 'Practice has no accurx_id', undefined, undefined, workerIndex);
      return;
    }

    const page = this.pages[workerIndex];
    const url = BASE_TEMPLATE_URL.replace('{id}', practice.accurx_id);
    const stepIndex = step.id; // unique per step, stable across workers

    const result = await this.processOnePractice(page, config, url, practice, step.id, stepIndex, runId, workerIndex);

    this.completedCount++;
    if (result.status === 'failed') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.deps.maxConsecutiveFailures && !this.abortReason) {
        this.abortReason = `Aborted after ${this.consecutiveFailures} consecutive failures (last: ${result.error ?? 'unknown'})`;
        this.token.cancel();
      }
    } else {
      this.consecutiveFailures = 0;
    }

    this.sink.send('automation:progress', {
      runId,
      step: this.completedCount,
      total,
      practice: practice.name,
      status: result.status,
      error: result.error,
      screenshotPath: result.screenshotPath,
      workerIndex,
      accountLabel: this.label(config),
      timestamp: new Date().toISOString(),
    });
  }

  private async processOnePractice(
    page: Page,
    config: RunConfig,
    url: string,
    practice: { name: string; accurx_id: string },
    stepId: number,
    stepIndex: number,
    runId: number,
    workerIndex: number,
    attempt = 1,
  ): Promise<{ status: 'success' | 'failed' | 'skipped'; screenshotPath?: string; error?: string }> {
    try {
      await this.token.race(page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }));

      if (page.url().includes('/login') || page.url().includes('/two-factor')) {
        throw new Error('Session expired — Accurx redirected to login page');
      }

      if (config.type === 'create') {
        const result = await this.token.race(this.deps.createTemplate(page, config.templateConfig));
        if (result.alreadyExists) {
          updateRunStep(this.db, stepId, 'skipped', 'Template already exists', undefined, undefined, workerIndex);
          return { status: 'skipped' };
        }
        if (!result.success) throw new Error(result.error || 'Template creation failed');
      } else {
        const result = await this.token.race(this.deps.deleteTemplate(page, config.templateConfig.template_name));
        if (result.notFound) {
          updateRunStep(this.db, stepId, 'skipped', 'Template not found', undefined, undefined, workerIndex);
          return { status: 'skipped' };
        }
        if (!result.success) throw new Error(result.error || 'Template deletion failed');
      }

      await this.checkForLayoutChange(page, config.type);

      let ssPath: string | undefined;
      if (config.screenshotMode === 'every-step') {
        try {
          ssPath = await this.token.race(
            this.deps.captureScreenshot(page, this.deps.screenshotDir, runId, stepIndex, `w${workerIndex}-${practice.name}`),
          );
        } catch (e) {
          if (e instanceof CancellationError) throw e;
          /* a failed screenshot must not fail a successful step */
        }
      }

      updateRunStep(this.db, stepId, 'success', undefined, ssPath, undefined, workerIndex);
      return { status: 'success', screenshotPath: ssPath };
    } catch (error) {
      if (error instanceof CancellationError) throw error;
      if (this.token.isCancelled) throw new CancellationError();

      if (attempt < 2) {
        if (this.deps.retryDelayMs > 0) {
          await this.token.race(new Promise((r) => setTimeout(r, this.deps.retryDelayMs)));
        }
        return this.processOnePractice(page, config, url, practice, stepId, stepIndex, runId, workerIndex, 2);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);

      let ssPath: string | undefined;
      if (config.screenshotMode !== 'off') {
        try {
          ssPath = await this.token.race(
            this.deps.captureScreenshot(page, this.deps.screenshotDir, runId, stepIndex, `w${workerIndex}-${practice.name}-error`),
          );
        } catch (e) {
          if (e instanceof CancellationError) throw e;
        }
      }

      updateRunStep(this.db, stepId, 'failed', errorMsg, ssPath, undefined, workerIndex);
      return { status: 'failed', screenshotPath: ssPath, error: errorMsg };
    }
  }

  /**
   * Compare the page structure once per run against the previous run's snapshot,
   * so an Accurx redesign is flagged once rather than on every practice.
   */
  private async checkForLayoutChange(page: Page, action: 'create' | 'delete'): Promise<void> {
    if (this.changeChecked) return;
    this.changeChecked = true;
    try {
      const currentHash = hashDom(await this.token.race(page.content()));
      const previous = getCurrentSnapshot(this.db, action);
      if (previous && previous.dom_hash !== currentHash) {
        this.sink.send('automation:change-detected', { action, domHashChanged: true, changes: [] });
      }
      saveSnapshot(this.db, action, {}, currentHash);
    } catch (e) {
      if (e instanceof CancellationError) throw e;
    }
  }

  /** Cancel the run. Closes all pages to force-abort in-flight Playwright operations. */
  async stop(): Promise<void> {
    this.token.cancel();
    await Promise.allSettled(this.pages.map((p) => p.close().catch(() => {})));
  }

  private async cleanup(): Promise<void> {
    if (this.powerSaveId !== null && this.deps.powerSaveBlocker) {
      try { this.deps.powerSaveBlocker.stop(this.powerSaveId); } catch { /* ignore */ }
      this.powerSaveId = null;
    }
    this.pages = [];
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
