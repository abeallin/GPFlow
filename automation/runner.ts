import { chromium, type Browser, type Page } from 'playwright-core';
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
import path from 'path';

const BASE_TEMPLATE_URL = 'https://web.accurx.com/w/{id}/settings/templates?tab=OrganisationTemplates';

interface RunConfig {
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
}

export class AutomationRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cancelled = false;
  private powerSaveId: number | null = null;
  private mainWindow: BrowserWindow;
  private db: Database.Database;

  constructor(mainWindow: BrowserWindow, db: Database.Database) {
    this.mainWindow = mainWindow;
    this.db = db;
  }

  async run(config: RunConfig): Promise<number> {
    this.cancelled = false;

    // Prevent display sleep during automation
    try {
      const { powerSaveBlocker } = require('electron');
      this.powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    } catch { /* not in electron context */ }

    const runId = createRun(this.db, config.type, config.templateConfig, config.practiceIds);
    const steps = getRunSteps(this.db, runId);

    let screenshotPath: string;
    try {
      const { app } = require('electron');
      screenshotPath = path.join(app.getPath('userData'), 'screenshots');
    } catch {
      screenshotPath = path.join(process.cwd(), 'screenshots');
    }

    try {
      this.browser = await chromium.launch({
        headless: false,
      });
      this.page = await this.browser.newPage();

      // Login
      const loginResult = await loginToAccurx(
        this.page,
        config.credentials.username,
        config.credentials.password,
      );

      if (loginResult.requires2fa) {
        this.mainWindow.webContents.send('automation:2fa-required', { runId });
        const completed = await waitFor2faCompletion(this.page);
        if (!completed) {
          throw new Error('2FA timeout — user did not complete within 5 minutes');
        }
      } else if (!loginResult.success) {
        throw new Error(`Login failed: ${loginResult.error}`);
      }

      // Process each practice
      for (let i = 0; i < steps.length; i++) {
        if (this.cancelled) {
          for (let j = i; j < steps.length; j++) {
            updateRunStep(this.db, steps[j].id, 'cancelled');
          }
          break;
        }

        const step = steps[i];
        const practice = getPracticeById(this.db, step.practice_id);
        if (!practice) {
          updateRunStep(this.db, step.id, 'skipped', 'Practice not found');
          continue;
        }

        const url = BASE_TEMPLATE_URL.replace('{id}', practice.accurx_id);
        const result = await this.processOnePractice(
          config, url, practice, step.id, i, runId, screenshotPath,
        );

        this.mainWindow.webContents.send('automation:progress', {
          runId,
          step: i + 1,
          total: steps.length,
          practice: practice.name,
          status: result.status,
          screenshotPath: result.screenshotPath,
          timestamp: new Date().toISOString(),
        });
      }

      completeRun(this.db, runId);

      const finalRun = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
      this.mainWindow.webContents.send('automation:complete', {
        runId,
        summary: {
          totalCount: finalRun.total_count,
          successCount: finalRun.success_count,
          failCount: finalRun.fail_count,
          duration: new Date(finalRun.completed_at).getTime() - new Date(finalRun.started_at).getTime(),
        },
      });

      return runId;
    } catch (error) {
      this.db.prepare('UPDATE runs SET status = ?, completed_at = datetime("now") WHERE id = ?')
        .run('failed', runId);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async processOnePractice(
    config: RunConfig,
    url: string,
    practice: { name: string; accurx_id: string },
    stepId: number,
    stepIndex: number,
    runId: number,
    screenshotPath: string,
    attempt = 1,
  ): Promise<{ status: string; screenshotPath?: string }> {
    try {
      await this.page!.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      let success: boolean;

      if (config.type === 'create') {
        const result = await createTemplate(this.page!, config.templateConfig);
        success = result.success || result.alreadyExists;
        if (result.alreadyExists) {
          updateRunStep(this.db, stepId, 'skipped', 'Template already exists');
          return { status: 'skipped' };
        }
      } else {
        const result = await deleteTemplate(this.page!, config.templateConfig.template_name);
        success = result.success;
      }

      if (success) {
        const domContent = await this.page!.content();
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

        let ssPath: string | undefined;
        if (config.screenshotMode === 'every-step') {
          ssPath = await captureScreenshot(this.page!, screenshotPath, runId, stepIndex, practice.name);
        }

        updateRunStep(this.db, stepId, 'success', undefined, ssPath);
        return { status: 'success', screenshotPath: ssPath };
      }

      throw new Error('Action returned failure');
    } catch (error) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000));
        return this.processOnePractice(config, url, practice, stepId, stepIndex, runId, screenshotPath, 2);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);

      let ssPath: string | undefined;
      if (config.screenshotMode !== 'off') {
        try {
          ssPath = await captureScreenshot(this.page!, screenshotPath, runId, stepIndex, `${practice.name}-error`);
        } catch { /* ignore screenshot failure */ }
      }

      updateRunStep(this.db, stepId, 'failed', errorMsg, ssPath);
      return { status: 'failed', screenshotPath: ssPath };
    }
  }

  stop(): void {
    this.cancelled = true;
  }

  private async cleanup(): Promise<void> {
    if (this.powerSaveId !== null) {
      try {
        const { powerSaveBlocker } = require('electron');
        powerSaveBlocker.stop(this.powerSaveId);
      } catch { /* not in electron context */ }
      this.powerSaveId = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
