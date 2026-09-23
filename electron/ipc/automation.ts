import { app, ipcMain, powerSaveBlocker, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type Database from 'better-sqlite3';
import path from 'path';
import { AutomationRunner, type EventSink } from '../../automation/runner';
import { getFailedPracticeIds } from '../../database/queries/runs';
import { createAutomationController, type AutomationController } from './automation-controller';
import { isTrustedSender, type OriginPolicy } from '../security';

let controller: AutomationController | null = null;

function guard(policy: OriginPolicy, event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event.senderFrame?.url, policy)) {
    throw new Error('Automation IPC rejected: untrusted sender');
  }
}

/**
 * @param getWindow resolves the current main window at send time, so events still
 *                  reach a window recreated after `activate` on macOS.
 */
export function registerAutomationHandlers(
  getWindow: () => BrowserWindow | null,
  db: Database.Database,
  policy: OriginPolicy,
): AutomationController {
  const sink: EventSink = {
    send: (channel, payload) => {
      const win = getWindow();
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    },
  };

  controller = createAutomationController({
    sink,
    makeRunner: () => new AutomationRunner(sink, db, {
      powerSaveBlocker: {
        start: () => powerSaveBlocker.start('prevent-display-sleep'),
        stop: (id) => powerSaveBlocker.stop(id),
      },
      screenshotDir: path.join(app.getPath('userData'), 'screenshots'),
    }),
    getFailedPracticeIds: (runId) => getFailedPracticeIds(db, runId),
  });

  const c = controller;

  ipcMain.handle('automation:start', (event, config) => { guard(policy, event); return c.start(config); });
  ipcMain.handle('automation:stop', (event, { runId }: { runId: number }) => { guard(policy, event); return c.stop(runId); });
  ipcMain.handle('automation:stop-all', (event) => { guard(policy, event); return c.stopAll(); });
  ipcMain.handle('automation:active-runs', (event) => { guard(policy, event); return c.activeRuns(); });
  ipcMain.handle('automation:retry-failed', (event, { runId }: { runId: number }) => { guard(policy, event); return c.retryFailed(runId); });

  return controller;
}

/** Stop all active runners and wait for them to finish writing. Called on app quit. */
export async function shutdownAutomation(): Promise<void> {
  if (!controller) return;
  await controller.stopAll();
  await controller.waitForAll();
}
