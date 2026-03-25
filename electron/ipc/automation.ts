import { ipcMain, BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import { AutomationRunner } from '../../automation/runner';
import { getFailedPracticeIds } from '../../database/queries/runs';
import type { ScreenshotMode } from '../../automation/screenshots';

let activeRunner: AutomationRunner | null = null;

export function registerAutomationHandlers(mainWindow: BrowserWindow, db: Database.Database): void {
  ipcMain.handle('automation:start', async (_event, config: {
    type: 'create' | 'delete';
    templateConfig: any;
    practiceIds: number[];
    screenshotMode: ScreenshotMode;
    credentials: { username: string; password: string };
  }) => {
    if (activeRunner) {
      throw new Error('A run is already in progress');
    }

    activeRunner = new AutomationRunner(mainWindow, db);

    try {
      const runId = await activeRunner.run({
        type: config.type,
        templateConfig: config.templateConfig,
        practiceIds: config.practiceIds,
        screenshotMode: config.screenshotMode,
        credentials: config.credentials,
      });
      return { runId };
    } finally {
      activeRunner = null;
    }
  });

  ipcMain.handle('automation:stop', async (_event, { runId }: { runId: number }) => {
    if (activeRunner) {
      activeRunner.stop();
    }
  });

  ipcMain.handle('automation:retry-failed', async (_event, { runId }: { runId: number }) => {
    const failedIds = getFailedPracticeIds(db, runId);
    if (failedIds.length === 0) {
      throw new Error('No failed practices to retry');
    }
    return { practiceIds: failedIds };
  });

  ipcMain.handle('automation:2fa-continue', async () => {
    // 2FA completion is detected by URL change in the runner
  });
}
