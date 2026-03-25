declare global {
  interface Window {
    electronAPI: {
      login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
      validateLicense: (key: string) => Promise<{ valid: boolean; cached: boolean }>;
      saveCredentials: (creds: { username: string; password: string; licenseKey: string }) => Promise<void>;
      importCsv: (filePath?: string) => Promise<{ rowCount: number; errors: string[] }>;
      getPractices: (filters?: Record<string, string>, sort?: { field: string; asc: boolean }) => Promise<any[]>;
      getSavedTemplates: () => Promise<any[]>;
      saveTemplate: (template: any) => Promise<{ id: number }>;
      getRuns: (limit?: number, offset?: number) => Promise<any[]>;
      startRun: (config: any) => Promise<{ runId: number }>;
      stopRun: (runId: number) => Promise<void>;
      retryFailed: (runId: number) => Promise<{ practiceIds: number[] }>;
      continuePast2fa: (runId: number) => Promise<void>;
      onProgress: (callback: (event: any) => void) => void;
      on2faRequired: (callback: (event: any) => void) => void;
      onRunComplete: (callback: (event: any) => void) => void;
      onChangeDetected: (callback: (event: any) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export const ipc = typeof window !== 'undefined' ? window.electronAPI : null;
