import { contextBridge, ipcRenderer } from 'electron';

// Keep in sync with src/lib/ipc-client.ts (ElectronAPI).
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  validateLicense: (key: string) =>
    ipcRenderer.invoke('auth:validate-license', { key }),
  saveCredentials: (creds: { accountId: string; username: string; password: string; licenseKey: string }) =>
    ipcRenderer.invoke('auth:save-credentials', creds),
  getCredentials: (accountId: string) =>
    ipcRenderer.invoke('auth:get-credentials', { accountId }),
  deleteCredentials: (accountId: string) =>
    ipcRenderer.invoke('auth:delete-credentials', { accountId }),
  logout: () =>
    ipcRenderer.invoke('auth:logout'),

  // Database
  importCsv: () =>
    ipcRenderer.invoke('db:import-csv'),
  getPractices: (filters?: Record<string, string>, sort?: { field: string; asc: boolean }) =>
    ipcRenderer.invoke('db:get-practices', { filters, sort }),
  getSavedTemplates: () =>
    ipcRenderer.invoke('db:get-saved-templates'),
  saveTemplate: (template: unknown) =>
    ipcRenderer.invoke('db:save-template', template),
  getRuns: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('db:get-runs', { limit, offset }),
  getImportFolder: () =>
    ipcRenderer.invoke('db:get-import-folder'),
  clearPractices: () =>
    ipcRenderer.invoke('db:clear-practices'),

  // Automation
  startRun: (config: unknown) =>
    ipcRenderer.invoke('automation:start', config),
  stopRun: (runId: number) =>
    ipcRenderer.invoke('automation:stop', { runId }),
  stopAllRuns: () =>
    ipcRenderer.invoke('automation:stop-all'),
  getActiveRuns: () =>
    ipcRenderer.invoke('automation:active-runs'),
  retryFailed: (runId: number) =>
    ipcRenderer.invoke('automation:retry-failed', { runId }),

  // Event listeners (main → renderer push)
  onProgress: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:progress', (_event, data) => callback(data)),
  on2faRequired: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:2fa-required', (_event, data) => callback(data)),
  onRunComplete: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:complete', (_event, data) => callback(data)),
  onRunError: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:error', (_event, data) => callback(data)),
  onChangeDetected: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:change-detected', (_event, data) => callback(data)),
  onPracticesUpdated: (callback: () => void) =>
    ipcRenderer.on('db:practices-updated', () => callback()),

  // Cleanup
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
});
