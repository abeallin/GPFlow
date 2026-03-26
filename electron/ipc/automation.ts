import { ipcMain, BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import { AutomationRunner } from '../../automation/runner';
import { getFailedPracticeIds } from '../../database/queries/runs';
import type { ScreenshotMode } from '../../automation/screenshots';

// Map of runner key → active runner. Supports concurrent runners (one per account).
const activeRunners = new Map<string, { runner: AutomationRunner; runId: number }>();

export function registerAutomationHandlers(mainWindow: BrowserWindow, db: Database.Database): void {
  ipcMain.handle('automation:start', async (_event, config: {
    type: 'create' | 'delete';
    templateConfig: any;
    practiceIds: number[];
    screenshotMode: ScreenshotMode;
    credentials: { username: string; password: string };
    concurrency?: number;
  }) => {
    const key = config.credentials?.username || 'default';

    if (activeRunners.has(key)) {
      throw new Error(`A run is already in progress for account: ${key}`);
    }

    const runner = new AutomationRunner(mainWindow, db);

    try {
      const runId = await runner.run({
        type: config.type,
        templateConfig: config.templateConfig,
        practiceIds: config.practiceIds,
        screenshotMode: config.screenshotMode,
        credentials: config.credentials,
        concurrency: config.concurrency,
      });
      activeRunners.set(key, { runner, runId });
      return { runId };
    } finally {
      activeRunners.delete(key);
    }
  });

  ipcMain.handle('automation:stop', async (_event, { runId }: { runId: number }) => {
    // Find runner by runId
    for (const [key, entry] of activeRunners) {
      if (entry.runId === runId) {
        await entry.runner.stop();
        return;
      }
    }
    // Stop all if no specific runId match
    await Promise.allSettled(
      [...activeRunners.values()].map((e) => e.runner.stop()),
    );
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

  ipcMain.handle('automation:active-runners', async () => {
    return [...activeRunners.keys()];
  });
}
