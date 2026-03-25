// Database models
export interface Practice {
  id: number;
  name: string;
  accurx_id: string;
  metadata: Record<string, string>;
  imported_at: string;
  source_file: string;
}

export interface Run {
  id: number;
  started_at: string;
  completed_at: string | null;
  type: 'create' | 'delete';
  template_config: TemplateConfig;
  total_count: number;
  success_count: number;
  fail_count: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface RunStep {
  id: number;
  run_id: number;
  practice_id: number;
  status: 'pending' | 'success' | 'failed' | 'skipped' | 'cancelled';
  error_message: string | null;
  screenshot_path: string | null;
  dom_snapshot: string | null;
  completed_at: string | null;
}

export interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

export interface SavedTemplate {
  id: number;
  name: string;
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageSnapshot {
  id: number;
  action: 'login' | 'create' | 'delete';
  selectors: Record<string, string[]>;
  dom_hash: string;
  captured_at: string;
  is_current: boolean;
}

export interface LicenseCache {
  key_hash: string;
  is_valid: boolean;
  validated_at: string;
}

// IPC event types
export interface ProgressEvent {
  runId: number;
  step: number;
  total: number;
  practice: string;
  status: 'success' | 'failed' | 'skipped';
  screenshotPath?: string;
  timestamp: string;
}

export interface RunSummary {
  runId: number;
  totalCount: number;
  successCount: number;
  failCount: number;
  duration: number;
}
