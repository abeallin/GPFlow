import type { PracticeLike } from './assignments';
import type { Run, SavedTemplate } from './types';
/**
 * Renderer-side view of the Electron preload bridge.
 * This file is the single source of truth for the renderer ↔ main contract.
 */

export interface RunPractice {
  /** Renderer-side practice id (stable per import, stored on run_steps.practice_id). */
  id: number;
  name: string;
  accurx_id: string;
}

export interface StartRunConfig {
  type: 'create' | 'delete';
  templateConfig: {
    template_name: string;
    message: string;
    individual: boolean;
    batch: boolean;
    allow_respond: boolean;
  };
  /** Full practice records — the main process no longer looks these up in SQLite. */
  practices: RunPractice[];
  screenshotMode: 'off' | 'on-failure' | 'every-step';
  credentials: { username: string; password: string };
  accountLabel?: string;
  concurrency?: number;
  authMethod?: 'direct' | 'sso';
}

export interface ActiveRun {
  runId: number;
  accountLabel: string;
}

export interface ProgressEvent {
  runId: number;
  step: number;
  total: number;
  practice: string;
  status: 'success' | 'failed' | 'skipped';
  /** Present when status is 'failed'. */
  error?: string;
  screenshotPath?: string;
  workerIndex?: number;
  accountLabel?: string;
  timestamp: string;
}

export interface RunSummary {
  totalCount: number;
  successCount: number;
  failCount: number;
  duration: number;
}

export interface RunCompleteEvent {
  runId: number;
  accountLabel: string;
  summary: RunSummary;
}

export interface RunErrorEvent {
  runId: number;
  accountLabel: string;
  error: string;
}

/** What the renderer supplies when saving a template; the database adds id and timestamps. */
export type NewSavedTemplate = Omit<SavedTemplate, 'id' | 'created_at' | 'updated_at'>;

export interface ChangeDetectedEvent {
  action: string;
  domHashChanged: boolean;
  changes: unknown[];
}

export interface TwoFactorEvent {
  runId: number;
  accountLabel: string;
}

export interface ElectronAPI {
  // Auth
  validateLicense: (key: string) => Promise<{ valid: boolean; cached: boolean }>;
  saveCredentials: (creds: { accountId: string; username: string; password: string; licenseKey: string }) => Promise<void>;
  getCredentials: (accountId: string) => Promise<{ username: string; password: string; licenseKey: string } | null>;
  deleteCredentials: (accountId: string) => Promise<void>;
  logout: () => Promise<void>;

  // Database
  /** Opens a native file picker. The renderer can no longer supply a path. */
  importCsv: () => Promise<{ rowCount: number; errors: string[] }>;
  getPractices: (filters?: Record<string, string>, sort?: { field: string; asc: boolean }) => Promise<PracticeLike[]>;
  getSavedTemplates: () => Promise<SavedTemplate[]>;
  saveTemplate: (template: NewSavedTemplate) => Promise<{ id: number }>;
  getRuns: (limit?: number, offset?: number) => Promise<Run[]>;
  getImportFolder: () => Promise<string>;
  clearPractices: () => Promise<void>;

  // Automation
  /** Resolves as soon as the run is registered; the run continues in the background. */
  startRun: (config: StartRunConfig) => Promise<{ runId: number }>;
  stopRun: (runId: number) => Promise<void>;
  stopAllRuns: () => Promise<void>;
  getActiveRuns: () => Promise<ActiveRun[]>;
  retryFailed: (runId: number) => Promise<{
    practiceIds: number[];
    type?: 'create' | 'delete';
    templateConfig?: Record<string, unknown>;
  }>;

  // Events (main → renderer)
  onProgress: (callback: (event: ProgressEvent) => void) => void;
  on2faRequired: (callback: (event: TwoFactorEvent) => void) => void;
  onRunComplete: (callback: (event: RunCompleteEvent) => void) => void;
  onRunError: (callback: (event: RunErrorEvent) => void) => void;
  onChangeDetected: (callback: (event: ChangeDetectedEvent) => void) => void;
  onPracticesUpdated: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

class WebIpcClient implements ElectronAPI {
  readonly isWeb = true;
  private eventSource: EventSource | null = null;
  private listeners = new Map<string, Set<(payload: any) => void>>();

  private ensureEventSource() {
    if (typeof window === 'undefined' || this.eventSource) return;
    try {
      this.eventSource = new EventSource('/api/automation/events/');
      this.eventSource.onmessage = (e) => {
        try {
          const { channel, payload } = JSON.parse(e.data);
          const channelListeners = this.listeners.get(channel);
          if (channelListeners) {
            for (const cb of channelListeners) cb(payload);
          }
        } catch {
          // Ignore parse errors or non-json keepalives
        }
      };
      this.eventSource.onerror = () => {
        // EventSource will auto-reconnect
      };
    } catch (err) {
      console.warn('Failed to connect to automation event stream:', err);
    }
  }

  private addListener(channel: string, cb: (payload: any) => void) {
    this.ensureEventSource();
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(cb);
  }

  async validateLicense(_key: string) {
    return { valid: true, cached: true };
  }

  async saveCredentials(creds: { accountId: string; username: string; password: string; licenseKey: string }) {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem('gpflow_passwords') || '{}');
      stored[creds.accountId] = creds.password;
      const json = JSON.stringify(stored);
      localStorage.setItem('gpflow_passwords', json);
      sessionStorage.setItem('gpflow_passwords', json);
    } catch {
      // ignore
    }
  }

  async getCredentials(accountId: string) {
    if (typeof window === 'undefined') return null;
    try {
      const stored =
        sessionStorage.getItem('gpflow_passwords') ||
        localStorage.getItem('gpflow_passwords');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const password = parsed[accountId];
      if (!password) return null;
      return { username: '', password, licenseKey: '' };
    } catch {
      return null;
    }
  }

  async deleteCredentials(accountId: string) {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem('gpflow_passwords') || '{}');
      delete stored[accountId];
      const json = JSON.stringify(stored);
      localStorage.setItem('gpflow_passwords', json);
      sessionStorage.setItem('gpflow_passwords', json);
    } catch {
      // ignore
    }
  }
  async logout() {}

  async importCsv() {
    return { rowCount: 0, errors: ['Use browser file picker on the data page'] };
  }
  async getPractices() { return []; }
  async getSavedTemplates() { return []; }
  async saveTemplate() { return { id: 1 }; }

  async getRuns(limit = 50, offset = 0): Promise<Run[]> {
    try {
      const res = await fetch(`/api/automation/runs/?history=true&limit=${limit}&offset=${offset}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.runs) ? data.runs : [];
    } catch {
      return [];
    }
  }

  async getImportFolder() { return ''; }
  async clearPractices() {}

  async startRun(config: StartRunConfig): Promise<{ runId: number }> {
    const res = await fetch('/api/automation/start/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to start run');
    }
    return data;
  }

  async stopRun(runId: number): Promise<void> {
    await fetch('/api/automation/stop/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId }),
    });
  }

  async stopAllRuns(): Promise<void> {
    await fetch('/api/automation/stop/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  }

  async getActiveRuns(): Promise<ActiveRun[]> {
    try {
      const res = await fetch('/api/automation/runs/');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.activeRuns) ? data.activeRuns : [];
    } catch {
      return [];
    }
  }

  async retryFailed(runId: number): Promise<{
    practiceIds: number[];
    type?: 'create' | 'delete';
    templateConfig?: Record<string, unknown>;
  }> {
    const res = await fetch(`/api/automation/retry/?runId=${runId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to retry run');
    }
    return await res.json();
  }

  onProgress(callback: (event: ProgressEvent) => void) {
    this.addListener('automation:progress', callback);
  }
  on2faRequired(callback: (event: TwoFactorEvent) => void) {
    this.addListener('automation:2fa-required', callback);
  }
  onRunComplete(callback: (event: RunCompleteEvent) => void) {
    this.addListener('automation:complete', callback);
  }
  onRunError(callback: (event: RunErrorEvent) => void) {
    this.addListener('automation:error', callback);
  }
  onChangeDetected(callback: (event: ChangeDetectedEvent) => void) {
    this.addListener('automation:change-detected', callback);
  }
  onPracticesUpdated(_callback: () => void) {}

  removeAllListeners(channel: string) {
    this.listeners.delete(channel);
    if (this.listeners.size === 0 && this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const webApi = new WebIpcClient();

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const ipc: ElectronAPI =
  typeof window !== 'undefined'
    ? (window.electronAPI ?? webApi)
    : (webApi as unknown as ElectronAPI);

