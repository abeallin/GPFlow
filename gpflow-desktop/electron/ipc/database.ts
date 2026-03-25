import { ipcMain, dialog } from 'electron';
import type Database from 'better-sqlite3';
import { importCsv } from '../../database/csv-import';
import { getPractices } from '../../database/queries/practices';
import { getSavedTemplates, saveTemplate, deleteTemplate } from '../../database/queries/templates';
import { getRuns, getRunSteps } from '../../database/queries/runs';

export function registerDatabaseHandlers(db: Database.Database): void {
  ipcMain.handle('db:import-csv', async (_event, { filePath }: { filePath?: string }) => {
    let target = filePath;
    if (!target) {
      const result = await dialog.showOpenDialog({
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths[0]) {
        return { rowCount: 0, errors: ['Import cancelled'] };
      }
      target = result.filePaths[0];
    }
    return importCsv(db, target);
  });

  ipcMain.handle('db:get-practices', (_event, { filters, sort }: {
    filters?: Record<string, string>;
    sort?: { field: string; asc: boolean };
  }) => {
    return getPractices(db, filters, sort);
  });

  ipcMain.handle('db:get-saved-templates', () => {
    return getSavedTemplates(db);
  });

  ipcMain.handle('db:save-template', (_event, template: any) => {
    const id = saveTemplate(db, template);
    return { id };
  });

  ipcMain.handle('db:delete-template', (_event, { id }: { id: number }) => {
    deleteTemplate(db, id);
  });

  ipcMain.handle('db:get-runs', (_event, { limit, offset }: { limit?: number; offset?: number }) => {
    return getRuns(db, limit, offset);
  });

  ipcMain.handle('db:get-run-steps', (_event, { runId }: { runId: number }) => {
    return getRunSteps(db, runId);
  });
}
