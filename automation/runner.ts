import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import type { BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import { loginToAccurx, waitFor2faCompletion } from './actions/login';
import { createTemplate } from './actions/create-template';
import { deleteTemplate } from './actions/delete-template';
import { captureScreenshot, type ScreenshotMode } from './screenshots';
import { hashDom, diffSnapshots, type SnapshotData } from './change-detection';
import { createRun, updateRunStep, completeRun, getRunSteps } from '../database/queries/runs';
import { getPracticeById } from '../database/queries/practices';
import { saveSnapshot, getCurrentSnapshot } from '../database/queries/snapshots';
import { CancellationToken, CancellationError } from './cancellation-token';
import { WorkQueue } from './work-queue';
import path from 'path';

const BASE_TEMPLATE_URL = 'https://web.accurx.com/w/{id}/settings/templates?tab=OrganisationTemplates';

export interface RunConfig {
  type: 'create' | 'delete';
  templateConfig: {
    template_name: string;
    message: string;
    individual: boolean;
    batch: boolean;
    allow_respond: boolean;
  };
  practiceIds: number[];
  screenshotMode: ScreenshotMode;
  credentials: { username: string; password: string };
  concurrency?: number;
  accountLabel?: string;
}

export class AutomationRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Page[] = [];
  private token = new CancellationToken();
  private powerSaveId: number | null = null;
  private mainWindow: BrowserWindow;
  private db: Database.Database;
  private _completedCount = 0;

  constructor(mainWindow: BrowserWindow, db: Database.Database) {
    this.mainWindow = mainWindow;
    this.db = db;
  }

  /**
   * Run automation for a batch of practices.
   * O(n/k) wall time where n = practices, k = concurrency.
   */
  async run(config: RunConfig): Promise<number> {
    this.token = new CancellationToken();
    this._completedCount = 0;

    const concurrency = Math.max(1, Math.min(config.concurrency ?? 4, 15));

    // Prevent display sleep
    try {
      const { powerSaveBlocker } = require('electron');
      this.powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    } catch { /* not in electron context */ }

    const runId = createRun(this.db, config.type, config.templateConfig, config.practiceIds, concurrency);
    const steps = getRunSteps(this.db, runId);

    let screenshotPath: string;
    try {
      const { app } = require('electron');
      screenshotPath = path.join(app.getPath('userData'), 'screenshots');
    } catch {
      screenshotPath = path.join(process.cwd(), 'screenshots');
    }

    try {
      // Launch browser and create shared context
      this.browser = await chromium.launch({ headless: false });
      this.context = await this.browser.newContext();

      // Login on a dedicated page — all pages in the context share cookies
      const loginPage = await this.context.newPage();
      const loginResult = await this.token.race(
        loginToAccurx(loginPage, config.credentials.username, config.credentials.password),
      );

      if (loginResult.requires2fa) {
        this.mainWindow.webContents.send('automation:2fa-required', { runId });
        const completed = await this.token.race(waitFor2faCompletion(loginPage));
        if (!completed) {
          throw new Error('2FA timeout — user did not complete within 5 minutes');
        }
      } else if (!loginResult.success) {
        throw new Error(`Login failed: ${loginResult.error}`);
      }

      // Close login page — session cookies are in the context
      await loginPage.close();

      // Create k worker pages from the shared context
      const effectiveConcurrency = Math.min(concurrency, steps.length || 1);
      this.pages = await Promise.all(
        Array.from({ length: effectiveConcurrency }, () => this.context!.newPage()),
      );

      // Build work queue — O(n/k) distribution
      const queue = new WorkQueue<typeof steps[0]>({
        items: steps,
        concurrency: effectiveConcurrency,
        token: this.token,
        worker: async (step, workerIndex) => {
          this.token.throwIfCancelled();

          const practice = getPracticeById(this.db, step.practice_id);
          if (!practice) {
            updateRunStep(this.db, step.id, 'skipped', 'Practice not found', undefined, undefined, workerIndex);
            return;
          }

          const page = this.pages[workerIndex];
          const url = BASE_TEMPLATE_URL.replace('{id}', practice.accurx_id);

          const result = await this.processOnePractice(
            page, config, url, practice, step.id, this._completedCount, runId, screenshotPath, workerIndex,
          );

          this._completedCount++;

          this.mainWindow.webContents.send('automation:progress', {
            runId,
            step: this._completedCount,
            total: steps.length,
            practice: practice.name,
            status: result.status,
            screenshotPath: result.screenshotPath,
            workerIndex,
            accountLabel: config.accountLabel || config.credentials.username,
            timestamp: new Date().toISOString(),
          });
        },
      });

      await queue.run();

      // Mark any remaining unprocessed steps as cancelled — O(remaining)
      if (this.token.isCancelled) {
        const cancelTx = this.db.transaction(() => {
          for (let i = queue.cursor; i < steps.length; i++) {
            const step = steps[i];
            const current = this.db.prepare('SELECT status FROM run_steps WHERE id = ?').get(step.id) as any;
            if (current?.status === 'pending') {
              updateRunStep(this.db, step.id, 'cancelled');
            }
          }
        });
        cancelTx();
      }

      completeRun(this.db, runId);

      const finalRun = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
      this.mainWindow.webContents.send('automation:complete', {
        runId,
        accountLabel: config.accountLabel || config.credentials.username,
        summary: {
          totalCount: finalRun.total_count,
          successCount: finalRun.success_count,
          failCount: finalRun.fail_count,
          duration: new Date(finalRun.completed_at).getTime() - new Date(finalRun.started_at).getTime(),
        },
      });

      return runId;
    } catch (error) {
      if (!(error instanceof CancellationError)) {
        this.db.prepare(`UPDATE runs SET status = ?, completed_at = datetime('now') WHERE id = ?`)
          .run('failed', runId);
      }
      if (error instanceof CancellationError) {
        completeRun(this.db, runId);
        return runId;
      }
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Process a single practice on a specific page.
   * Every Playwright await is wrapped with token.race() for sub-second cancellation.
   */
  private async processOnePractice(
    page: Page,
    config: RunConfig,
    url: string,
    practice: { name: string; accurx_id: string },
    stepId: number,
    stepIndex: number,
    runId: number,
    screenshotPath: string,
    workerIndex: number,
    attempt = 1,
  ): Promise<{ status: string; screenshotPath?: string }> {
    try {
      await this.token.race(
        page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }),
      );

      let success: boolean;

      if (config.type === 'create') {
        const result = await this.token.race(createTemplate(page, config.templateConfig));
        success = result.success || result.alreadyExists;
        if (result.alreadyExists) {
          updateRunStep(this.db, stepId, 'skipped', 'Template already exists', undefined, undefined, workerIndex);
          return { status: 'skipped' };
        }
      } else {
        const result = await this.token.race(deleteTemplate(page, config.templateConfig.template_name));
        success = result.success;
        if (!success && result.deletedCount === 0) {
          updateRunStep(this.db, stepId, 'skipped', 'Template not found', undefined, undefined, workerIndex);
          return { status: 'skipped' };
        }
      }

      if (success) {
        // Change detection: only worker 0 to avoid race conditions
        if (workerIndex === 0) {
          const domContent = await this.token.race(page.content());
          const currentHash = hashDom(domContent);
          const previousSnapshot = getCurrentSnapshot(this.db, config.type);

          if (previousSnapshot) {
            const currentSnapshot: SnapshotData = { selectors: {}, domHash: currentHash };
            const diff = diffSnapshots(
              { selectors: JSON.parse(previousSnapshot.selectors as any), domHash: previousSnapshot.dom_hash },
              currentSnapshot,
            );
            if (diff.changed) {
              this.mainWindow.webContents.send('automation:change-detected', {
                action: config.type,
                changes: diff.changes,
                domHashChanged: diff.domHashChanged,
              });
            }
          }
          saveSnapshot(this.db, config.type, {}, currentHash);
        }

        let ssPath: string | undefined;
        if (config.screenshotMode === 'every-step') {
          ssPath = await captureScreenshot(page, screenshotPath, runId, stepIndex, `w${workerIndex}-${practice.name}`);
        }

        updateRunStep(this.db, stepId, 'success', undefined, ssPath, undefined, workerIndex);
        return { status: 'success', screenshotPath: ssPath };
      }

      throw new Error('Action returned failure');
    } catch (error) {
      // Cancellation errors propagate immediately — no retry
      if (error instanceof CancellationError) throw error;

      if (attempt < 2) {
        // Cancellable retry delay
        await this.token.race(new Promise((r) => setTimeout(r, 3000)));
        return this.processOnePractice(page, config, url, practice, stepId, stepIndex, runId, screenshotPath, workerIndex, 2);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);

      let ssPath: string | undefined;
      if (config.screenshotMode !== 'off') {
        try {
          ssPath = await captureScreenshot(page, screenshotPath, runId, stepIndex, `w${workerIndex}-${practice.name}-error`);
        } catch { /* ignore screenshot failure */ }
      }

      updateRunStep(this.db, stepId, 'failed', errorMsg, ssPath, undefined, workerIndex);
      return { status: 'failed', screenshotPath: ssPath };
    }
  }

  /**
   * Cancel the run. Closes all pages to force-abort in-flight Playwright operations.
   * Sub-second cancellation — no waiting for timeouts.
   */
  async stop(): Promise<void> {
    this.token.cancel();
    // Close pages to interrupt in-flight network requests
    await Promise.allSettled(this.pages.map((p) => p.close().catch(() => {})));
  }

  private async cleanup(): Promise<void> {
    if (this.powerSaveId !== null) {
      try {
        const { powerSaveBlocker } = require('electron');
        powerSaveBlocker.stop(this.powerSaveId);
      } catch { /* not in electron context */ }
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
