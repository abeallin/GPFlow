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
  retryFailed: (runId: number) => Promise<{ practiceIds: number[] }>;

  // Events (main → renderer)
  onProgress: (callback: (event: ProgressEvent) => void) => void;
  on2faRequired: (callback: (event: TwoFactorEvent) => void) => void;
  onRunComplete: (callback: (event: RunCompleteEvent) => void) => void;
  onRunError: (callback: (event: RunErrorEvent) => void) => void;
  onChangeDetected: (callback: (event: ChangeDetectedEvent) => void) => void;
  onPracticesUpdated: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const ipc: ElectronAPI | null = typeof window !== 'undefined' ? (window.electronAPI ?? null) : null;
