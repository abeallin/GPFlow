import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', { username, password }),
  validateLicense: (key: string) =>
    ipcRenderer.invoke('auth:validate-license', { key }),
  saveCredentials: (creds: { username: string; password: string; licenseKey: string }) =>
    ipcRenderer.invoke('auth:save-credentials', creds),
  logout: () =>
    ipcRenderer.invoke('auth:logout'),

  // Database
  importCsv: (filePath: string) =>
    ipcRenderer.invoke('db:import-csv', { filePath }),
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

  // Automation
  startRun: (config: { templateConfig: unknown; practiceIds: number[]; screenshotMode: string }) =>
    ipcRenderer.invoke('automation:start', config),
  stopRun: (runId: number) =>
    ipcRenderer.invoke('automation:stop', { runId }),
  retryFailed: (runId: number) =>
    ipcRenderer.invoke('automation:retry-failed', { runId }),
  continuePast2fa: (runId: number) =>
    ipcRenderer.invoke('automation:2fa-continue', { runId }),

  // Event listeners (main → renderer push)
  onProgress: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:progress', (_event, data) => callback(data)),
  on2faRequired: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:2fa-required', (_event, data) => callback(data)),
  onRunComplete: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:complete', (_event, data) => callback(data)),
  onChangeDetected: (callback: (event: unknown) => void) =>
    ipcRenderer.on('automation:change-detected', (_event, data) => callback(data)),
  onPracticesUpdated: (callback: () => void) =>
    ipcRenderer.on('db:practices-updated', () => callback()),

  // Cleanup
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
});
