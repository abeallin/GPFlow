import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron';
import type Database from 'better-sqlite3';
import { importCsv } from '../../database/csv-import';
import { getPractices } from '../../database/queries/practices';
import { getSavedTemplates, saveTemplate, deleteTemplate, type NewSavedTemplate } from '../../database/queries/templates';
import { getRuns, getRunSteps } from '../../database/queries/runs';
import { isTrustedSender, type OriginPolicy } from '../security';

export function registerDatabaseHandlers(db: Database.Database, policy: OriginPolicy): void {
  const guard = (event: IpcMainInvokeEvent) => {
    if (!isTrustedSender(event.senderFrame?.url, policy)) {
      throw new Error('Database IPC rejected: untrusted sender');
    }
  };

  // The renderer never supplies a path: the user picks the file in a native dialog.
  ipcMain.handle('db:import-csv', async (event) => {
    guard(event);
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { rowCount: 0, errors: ['Import cancelled'] };
    }
    return importCsv(db, result.filePaths[0]);
  });

  ipcMain.handle('db:get-practices', (event, { filters, sort }: {
    filters?: Record<string, string>;
    sort?: { field: string; asc: boolean };
  } = {}) => {
    guard(event);
    return getPractices(db, filters, sort);
  });

  ipcMain.handle('db:get-saved-templates', (event) => { guard(event); return getSavedTemplates(db); });

  ipcMain.handle('db:save-template', (event, template: NewSavedTemplate) => {
    guard(event);
    return { id: saveTemplate(db, template) };
  });

  ipcMain.handle('db:delete-template', (event, { id }: { id: number }) => { guard(event); deleteTemplate(db, id); });

  ipcMain.handle('db:get-runs', (event, { limit, offset }: { limit?: number; offset?: number } = {}) => {
    guard(event);
    return getRuns(db, limit, offset);
  });

  ipcMain.handle('db:get-run-steps', (event, { runId }: { runId: number }) => { guard(event); return getRunSteps(db, runId); });

  ipcMain.handle('db:clear-practices', (event) => { guard(event); db.exec('DELETE FROM practices'); });
}
