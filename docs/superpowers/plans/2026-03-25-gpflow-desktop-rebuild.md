# GPFlow Desktop Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild GPFlow as a cross-platform Electron desktop app with React/TypeScript UI, Playwright automation, and SQLite persistence.

**Architecture:** Electron main process owns Playwright (in a worker thread) and SQLite. Next.js renderer communicates via typed IPC channels. Live progress pushed from main to renderer via `webContents.send`. Credentials stored in OS keychain via `safeStorage`.

**Tech Stack:** Electron, Next.js (App Router), React, TypeScript, Playwright, better-sqlite3, Tailwind CSS, Vitest, electron-vite, pnpm

**Spec:** `docs/superpowers/specs/2026-03-25-gpflow-desktop-rebuild-design.md`

---

## File Structure

```
gpflow-desktop/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── electron-builder.yml
├── electron/
│   ├── main.ts                        # Electron entry, window creation, IPC registration
│   ├── preload.ts                     # contextBridge exposing typed IPC to renderer
│   ├── worker.ts                      # Worker thread for Playwright automation
│   └── ipc/
│       ├── auth.ts                    # auth:* IPC handlers (login, license, credentials)
│       ├── database.ts                # db:* IPC handlers (CSV import, practices, templates, runs)
│       └── automation.ts              # automation:* IPC handlers (start, stop, retry, progress)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with sidebar nav
│   │   ├── page.tsx                   # Login screen
│   │   ├── data/page.tsx              # Data preview + CSV import
│   │   ├── templates/page.tsx         # Create/Delete template config
│   │   └── runs/page.tsx              # Run dashboard + history
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Tabs.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── LoginForm.tsx
│   │   ├── LicenseValidator.tsx
│   │   ├── DataTable.tsx
│   │   ├── CsvImporter.tsx
│   │   ├── TemplateForm.tsx
│   │   ├── ProgressFeed.tsx
│   │   └── RunHistory.tsx
│   ├── hooks/
│   │   ├── useIpc.ts                  # Generic typed IPC hook
│   │   └── useAutomationProgress.ts   # Subscribe to automation:progress events
│   └── lib/
│       ├── ipc-client.ts              # Typed IPC call wrappers
│       └── types.ts                   # Shared TypeScript types
├── automation/
│   ├── runner.ts                      # Orchestrates a full run (loop practices, emit progress)
│   ├── actions/
│   │   ├── login.ts                   # Accurx login + 2FA handling
│   │   ├── create-template.ts         # Create template on a single practice
│   │   └── delete-template.ts         # Delete template on a single practice
│   ├── locators.ts                    # Resilient locator definitions with fallback chains
│   ├── change-detection.ts            # DOM snapshot, diff, alert
│   └── screenshots.ts                 # Screenshot capture utility
├── database/
│   ├── connection.ts                  # SQLite connection singleton
│   ├── schema.ts                      # Table creation + migrations
│   ├── queries/
│   │   ├── practices.ts               # CRUD for practices table
│   │   ├── runs.ts                    # CRUD for runs + run_steps tables
│   │   ├── templates.ts               # CRUD for saved_templates table
│   │   ├── snapshots.ts               # CRUD for page_snapshots table
│   │   └── license-cache.ts           # License validation cache
│   └── csv-import.ts                  # CSV parsing + upsert into practices
├── next.config.js                     # Static export config for Electron
├── electron.vite.config.ts            # electron-vite build config
├── tests/
│   ├── database/
│   │   ├── schema.test.ts
│   │   ├── practices.test.ts
│   │   ├── runs.test.ts
│   │   ├── templates.test.ts
│   │   └── csv-import.test.ts
│   ├── automation/
│   │   ├── locators.test.ts
│   │   ├── change-detection.test.ts
│   │   └── runner.test.ts
│   └── ipc/
│       ├── auth.test.ts
│       └── database.test.ts
└── vitest.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `gpflow-desktop/package.json`
- Create: `gpflow-desktop/tsconfig.json`
- Create: `gpflow-desktop/tsconfig.node.json`
- Create: `gpflow-desktop/tailwind.config.ts`
- Create: `gpflow-desktop/postcss.config.js`
- Create: `gpflow-desktop/vitest.config.ts`
- Create: `gpflow-desktop/electron/main.ts`
- Create: `gpflow-desktop/electron/preload.ts`
- Create: `gpflow-desktop/src/app/layout.tsx`
- Create: `gpflow-desktop/src/app/page.tsx`
- Create: `gpflow-desktop/src/lib/types.ts`

- [ ] **Step 1: Initialize the project**

```bash
mkdir gpflow-desktop && cd gpflow-desktop
pnpm init
```

Set `"main": "dist-electron/main.js"` in `package.json` — this is required for Electron to find its entry point.

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add electron electron-vite next react react-dom better-sqlite3 playwright-core mongodb tailwindcss postcss autoprefixer
pnpm add -D typescript @types/react @types/react-dom @types/better-sqlite3 @types/node vitest electron-builder concurrently
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@electron/*": ["electron/*"],
      "@automation/*": ["automation/*"],
      "@database/*": ["database/*"]
    }
  },
  "include": ["src/**/*", "electron/**/*", "automation/**/*", "database/**/*"],
  "exclude": ["node_modules", "dist", ".next"]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist-electron"
  },
  "include": ["electron/**/*", "automation/**/*", "database/**/*"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@database': path.resolve(__dirname, 'database'),
      '@automation': path.resolve(__dirname, 'automation'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 5b: Create electron.vite.config.ts**

```typescript
import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/main.ts'),
      },
    },
    resolve: {
      alias: {
        '@database': path.resolve(__dirname, 'database'),
        '@automation': path.resolve(__dirname, 'automation'),
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {},
});
```

- [ ] **Step 5c: Create next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};
module.exports = nextConfig;
```

- [ ] **Step 6: Create tailwind.config.ts and postcss.config.js**

`tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', hover: '#1D4ED8', light: '#DBEAFE' },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
    },
  },
  plugins: [],
};
export default config;
```

`postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create shared types**

`src/lib/types.ts`:
```typescript
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
```

- [ ] **Step 8: Create Electron main process**

`electron/main.ts`:
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../.next/out/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 9: Create preload script**

`electron/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', { username, password }),
  validateLicense: (key: string) =>
    ipcRenderer.invoke('auth:validate-license', { key }),
  saveCredentials: (creds: { username: string; password: string; licenseKey: string }) =>
    ipcRenderer.invoke('auth:save-credentials', creds),

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

  // Cleanup
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
});
```

- [ ] **Step 10: Create minimal Next.js layout and page**

`src/app/layout.tsx`:
```tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
```

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/app/page.tsx`:
```tsx
export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">GP Flow</h1>
    </div>
  );
}
```

- [ ] **Step 11: Verify the app launches**

```bash
cd gpflow-desktop
pnpm run dev
```

Expected: Electron window opens showing "GP Flow" centered on screen.

- [ ] **Step 12: Commit**

```bash
git add gpflow-desktop/
git commit -m "feat: scaffold Electron + Next.js + Playwright project"
```

---

## Task 2: SQLite Database Layer

**Files:**
- Create: `gpflow-desktop/database/connection.ts`
- Create: `gpflow-desktop/database/schema.ts`
- Create: `gpflow-desktop/database/queries/practices.ts`
- Create: `gpflow-desktop/database/queries/runs.ts`
- Create: `gpflow-desktop/database/queries/templates.ts`
- Create: `gpflow-desktop/database/queries/snapshots.ts`
- Create: `gpflow-desktop/database/queries/license-cache.ts`
- Create: `gpflow-desktop/tests/database/schema.test.ts`
- Create: `gpflow-desktop/tests/database/practices.test.ts`

- [ ] **Step 1: Write failing test for database connection and schema**

`tests/database/schema.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '@database/schema';

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates all required tables', () => {
    createSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row: any) => row.name);

    expect(tables).toContain('practices');
    expect(tables).toContain('runs');
    expect(tables).toContain('run_steps');
    expect(tables).toContain('page_snapshots');
    expect(tables).toContain('saved_templates');
    expect(tables).toContain('license_cache');
  });

  it('is idempotent — running twice does not error', () => {
    createSchema(db);
    expect(() => createSchema(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/database/schema.test.ts
```

Expected: FAIL — `createSchema` not found.

- [ ] **Step 3: Implement database connection and schema**

`database/connection.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath =
    process.env.NODE_ENV === 'test'
      ? ':memory:'
      : path.join(app.getPath('userData'), 'gpflow.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

`database/schema.ts`:
```typescript
import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      accurx_id TEXT NOT NULL UNIQUE,
      metadata TEXT DEFAULT '{}',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      source_file TEXT
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      type TEXT NOT NULL CHECK (type IN ('create', 'delete')),
      template_config TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS run_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      practice_id INTEGER NOT NULL REFERENCES practices(id),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'skipped', 'cancelled')),
      error_message TEXT,
      screenshot_path TEXT,
      dom_snapshot TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS page_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL CHECK (action IN ('login', 'create', 'delete')),
      selectors TEXT NOT NULL DEFAULT '{}',
      dom_hash TEXT NOT NULL,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_current INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS saved_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_name TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      individual INTEGER NOT NULL DEFAULT 1,
      batch INTEGER NOT NULL DEFAULT 0,
      allow_respond INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_cache (
      key_hash TEXT PRIMARY KEY,
      is_valid INTEGER NOT NULL,
      validated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_run_steps_run_id ON run_steps(run_id);
    CREATE INDEX IF NOT EXISTS idx_practices_accurx_id ON practices(accurx_id);
  `);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/database/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test for practices queries**

`tests/database/practices.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '@database/schema';
import {
  upsertPractices,
  getPractices,
  getPracticeById,
} from '@database/queries/practices';

describe('Practices Queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('upserts practices from parsed CSV rows', () => {
    const rows = [
      { name: 'Park Surgery', accurx_id: '12345', region: 'North' },
      { name: 'Oak Practice', accurx_id: '67890', region: 'South' },
    ];
    const result = upsertPractices(db, rows, 'data.csv');
    expect(result.inserted).toBe(2);

    const all = getPractices(db);
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Park Surgery');
    expect(JSON.parse(all[0].metadata as string)).toEqual({ region: 'North' });
  });

  it('upserts existing practice by accurx_id', () => {
    const rows = [{ name: 'Park Surgery', accurx_id: '12345', region: 'North' }];
    upsertPractices(db, rows, 'v1.csv');
    upsertPractices(db, [{ name: 'Park Surgery Updated', accurx_id: '12345', region: 'West' }], 'v2.csv');

    const all = getPractices(db);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Park Surgery Updated');
    expect(all[0].source_file).toBe('v2.csv');
  });

  it('filters practices by column value', () => {
    upsertPractices(db, [
      { name: 'Park Surgery', accurx_id: '111', region: 'North' },
      { name: 'Oak Practice', accurx_id: '222', region: 'South' },
    ], 'data.csv');

    const filtered = getPractices(db, { name: 'Park' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].accurx_id).toBe('111');
  });

  it('gets a practice by id', () => {
    upsertPractices(db, [{ name: 'Park Surgery', accurx_id: '111' }], 'data.csv');
    const all = getPractices(db);
    const found = getPracticeById(db, all[0].id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Park Surgery');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm vitest run tests/database/practices.test.ts
```

Expected: FAIL — queries not found.

- [ ] **Step 7: Implement practices queries**

`database/queries/practices.ts`:
```typescript
import type Database from 'better-sqlite3';
import type { Practice } from '@/lib/types';

const FIXED_COLUMNS = ['name', 'accurx_id'];

export function upsertPractices(
  db: Database.Database,
  rows: Record<string, string>[],
  sourceFile: string,
): { inserted: number; updated: number } {
  let inserted = 0;
  let updated = 0;

  const upsert = db.prepare(`
    INSERT INTO practices (name, accurx_id, metadata, source_file)
    VALUES (@name, @accurx_id, @metadata, @source_file)
    ON CONFLICT (accurx_id) DO UPDATE SET
      name = @name,
      metadata = @metadata,
      source_file = @source_file,
      imported_at = datetime('now')
  `);

  const tx = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!FIXED_COLUMNS.includes(key)) {
          metadata[key] = value;
        }
      }

      const existing = db
        .prepare('SELECT id FROM practices WHERE accurx_id = ?')
        .get(row.accurx_id);

      upsert.run({
        name: row.name || '',
        accurx_id: row.accurx_id,
        metadata: JSON.stringify(metadata),
        source_file: sourceFile,
      });

      if (existing) updated++;
      else inserted++;
    }
  });

  tx(rows);
  return { inserted, updated };
}

export function getPractices(
  db: Database.Database,
  filters?: Record<string, string>,
  sort?: { field: string; asc: boolean },
): Practice[] {
  let query = 'SELECT * FROM practices';
  const params: string[] = [];

  const ALLOWED_COLUMNS = ['name', 'accurx_id', 'source_file'];

  if (filters && Object.keys(filters).length > 0) {
    const clauses = Object.entries(filters)
      .filter(([key]) => ALLOWED_COLUMNS.includes(key))
      .map(([key, value]) => {
        params.push(`${value}%`);
        return `${key} LIKE ?`;
      });
    if (clauses.length > 0) {
      query += ` WHERE ${clauses.join(' AND ')}`;
    }
  }

  if (sort) {
    query += ` ORDER BY ${sort.field} ${sort.asc ? 'ASC' : 'DESC'}`;
  }

  return db.prepare(query).all(...params) as Practice[];
}

export function getPracticeById(
  db: Database.Database,
  id: number,
): Practice | undefined {
  return db.prepare('SELECT * FROM practices WHERE id = ?').get(id) as Practice | undefined;
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
pnpm vitest run tests/database/practices.test.ts
```

Expected: PASS

- [ ] **Step 9: Implement remaining query modules**

`database/queries/runs.ts`:
```typescript
import type Database from 'better-sqlite3';
import type { Run, RunStep, TemplateConfig } from '@/lib/types';

export function createRun(
  db: Database.Database,
  type: 'create' | 'delete',
  templateConfig: TemplateConfig,
  practiceIds: number[],
): number {
  const result = db.prepare(`
    INSERT INTO runs (type, template_config, total_count)
    VALUES (?, ?, ?)
  `).run(type, JSON.stringify(templateConfig), practiceIds.length);

  const runId = result.lastInsertRowid as number;

  const insertStep = db.prepare(`
    INSERT INTO run_steps (run_id, practice_id) VALUES (?, ?)
  `);

  const tx = db.transaction(() => {
    for (const practiceId of practiceIds) {
      insertStep.run(runId, practiceId);
    }
  });
  tx();

  return runId;
}

export function updateRunStep(
  db: Database.Database,
  stepId: number,
  status: string,
  errorMessage?: string,
  screenshotPath?: string,
  domSnapshot?: string,
): void {
  db.prepare(`
    UPDATE run_steps SET
      status = ?,
      error_message = ?,
      screenshot_path = ?,
      dom_snapshot = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(status, errorMessage || null, screenshotPath || null, domSnapshot || null, stepId);
}

export function completeRun(db: Database.Database, runId: number): void {
  const counts = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as fail_count
    FROM run_steps WHERE run_id = ?
  `).get(runId) as { success_count: number; fail_count: number };

  const status = counts.fail_count > 0 ? 'failed' : 'completed';

  db.prepare(`
    UPDATE runs SET
      completed_at = datetime('now'),
      success_count = ?,
      fail_count = ?,
      status = ?
    WHERE id = ?
  `).run(counts.success_count, counts.fail_count, status, runId);
}

export function getRuns(db: Database.Database, limit = 50, offset = 0): Run[] {
  return db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as Run[];
}

export function getRunSteps(db: Database.Database, runId: number): RunStep[] {
  return db.prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY id')
    .all(runId) as RunStep[];
}

export function getFailedPracticeIds(db: Database.Database, runId: number): number[] {
  const rows = db.prepare(
    'SELECT practice_id FROM run_steps WHERE run_id = ? AND status = ?'
  ).all(runId, 'failed') as { practice_id: number }[];
  return rows.map((r) => r.practice_id);
}
```

`database/queries/templates.ts`:
```typescript
import type Database from 'better-sqlite3';
import type { SavedTemplate } from '@/lib/types';

export function saveTemplate(
  db: Database.Database,
  template: Omit<SavedTemplate, 'id' | 'created_at' | 'updated_at'>,
): number {
  const result = db.prepare(`
    INSERT INTO saved_templates (name, template_name, message, individual, batch, allow_respond)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    template.name,
    template.template_name,
    template.message,
    template.individual ? 1 : 0,
    template.batch ? 1 : 0,
    template.allow_respond ? 1 : 0,
  );
  return result.lastInsertRowid as number;
}

export function getSavedTemplates(db: Database.Database): SavedTemplate[] {
  return db.prepare('SELECT * FROM saved_templates ORDER BY updated_at DESC').all() as SavedTemplate[];
}

export function deleteTemplate(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM saved_templates WHERE id = ?').run(id);
}
```

`database/queries/snapshots.ts`:
```typescript
import type Database from 'better-sqlite3';
import type { PageSnapshot } from '@/lib/types';

export function saveSnapshot(
  db: Database.Database,
  action: string,
  selectors: Record<string, string[]>,
  domHash: string,
): number {
  // Mark previous snapshots for this action as not current
  db.prepare('UPDATE page_snapshots SET is_current = 0 WHERE action = ?').run(action);

  const result = db.prepare(`
    INSERT INTO page_snapshots (action, selectors, dom_hash, is_current)
    VALUES (?, ?, ?, 1)
  `).run(action, JSON.stringify(selectors), domHash);

  return result.lastInsertRowid as number;
}

export function getCurrentSnapshot(
  db: Database.Database,
  action: string,
): PageSnapshot | undefined {
  return db.prepare(
    'SELECT * FROM page_snapshots WHERE action = ? AND is_current = 1'
  ).get(action) as PageSnapshot | undefined;
}
```

`database/queries/license-cache.ts`:
```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';

const CACHE_TTL_DAYS = 7;

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function getCachedLicense(db: Database.Database, licenseKey: string): boolean | null {
  const keyHash = hashKey(licenseKey);
  const row = db.prepare(
    'SELECT is_valid, validated_at FROM license_cache WHERE key_hash = ?'
  ).get(keyHash) as { is_valid: number; validated_at: string } | undefined;

  if (!row) return null;

  const validatedAt = new Date(row.validated_at);
  const now = new Date();
  const diffDays = (now.getTime() - validatedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > CACHE_TTL_DAYS) return null; // Cache expired

  return row.is_valid === 1;
}

export function setCachedLicense(
  db: Database.Database,
  licenseKey: string,
  isValid: boolean,
): void {
  const keyHash = hashKey(licenseKey);
  db.prepare(`
    INSERT INTO license_cache (key_hash, is_valid, validated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT (key_hash) DO UPDATE SET
      is_valid = ?,
      validated_at = datetime('now')
  `).run(keyHash, isValid ? 1 : 0, isValid ? 1 : 0);
}
```

- [ ] **Step 10: Run all database tests**

```bash
pnpm vitest run tests/database/
```

Expected: All PASS

- [ ] **Step 11: Commit**

```bash
git add gpflow-desktop/database/ gpflow-desktop/tests/database/
git commit -m "feat: add SQLite database layer with schema and queries"
```

---

## Task 3: CSV Import

**Files:**
- Create: `gpflow-desktop/database/csv-import.ts`
- Create: `gpflow-desktop/tests/database/csv-import.test.ts`

- [ ] **Step 1: Write failing test**

`tests/database/csv-import.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '@database/schema';
import { importCsv } from '@database/csv-import';
import { getPractices } from '@database/queries/practices';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CSV Import', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpflow-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('imports a valid CSV with accurx_id column', () => {
    const csvPath = path.join(tmpDir, 'test.csv');
    fs.writeFileSync(csvPath, 'name,accurx_id,region\nPark Surgery,12345,North\nOak Practice,67890,South\n');

    const result = importCsv(db, csvPath);
    expect(result.rowCount).toBe(2);
    expect(result.errors).toHaveLength(0);

    const practices = getPractices(db);
    expect(practices).toHaveLength(2);
  });

  it('rejects CSV without accurx_id column', () => {
    const csvPath = path.join(tmpDir, 'bad.csv');
    fs.writeFileSync(csvPath, 'name,region\nPark Surgery,North\n');

    const result = importCsv(db, csvPath);
    expect(result.rowCount).toBe(0);
    expect(result.errors).toContain('CSV must contain an "accurx_id" column');
  });

  it('skips rows with empty accurx_id', () => {
    const csvPath = path.join(tmpDir, 'partial.csv');
    fs.writeFileSync(csvPath, 'name,accurx_id\nPark Surgery,12345\nBad Row,\n');

    const result = importCsv(db, csvPath);
    expect(result.rowCount).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/database/csv-import.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement CSV import**

`database/csv-import.ts`:
```typescript
import type Database from 'better-sqlite3';
import fs from 'fs';
import { upsertPractices } from './queries/practices';

interface CsvImportResult {
  rowCount: number;
  errors: string[];
}

export function importCsv(db: Database.Database, filePath: string): CsvImportResult {
  const errors: string[] = [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    return { rowCount: 0, errors: ['CSV file is empty or has no data rows'] };
  }

  // Parse header — handle BOM
  const header = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim());

  if (!header.includes('accurx_id')) {
    return { rowCount: 0, errors: ['CSV must contain an "accurx_id" column'] };
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};

    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] || '';
    }

    if (!row.accurx_id) {
      errors.push(`Row ${i + 1}: missing accurx_id, skipped`);
      continue;
    }

    rows.push(row);
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const result = upsertPractices(db, rows, fileName);

  return { rowCount: result.inserted + result.updated, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/database/csv-import.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add gpflow-desktop/database/csv-import.ts gpflow-desktop/tests/database/csv-import.test.ts
git commit -m "feat: add CSV import with validation and upsert"
```

---

## Task 4: Auth & License IPC Handlers

**Files:**
- Create: `gpflow-desktop/electron/ipc/auth.ts`
- Create: `gpflow-desktop/tests/ipc/auth.test.ts`

- [ ] **Step 1: Write failing test for license cache logic**

`tests/ipc/auth.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '@database/schema';
import { getCachedLicense, setCachedLicense } from '@database/queries/license-cache';

describe('License Cache', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns null for uncached key', () => {
    expect(getCachedLicense(db, 'unknown-key')).toBeNull();
  });

  it('caches and retrieves a valid license', () => {
    setCachedLicense(db, 'my-key', true);
    expect(getCachedLicense(db, 'my-key')).toBe(true);
  });

  it('caches and retrieves an invalid license', () => {
    setCachedLicense(db, 'bad-key', false);
    expect(getCachedLicense(db, 'bad-key')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (implementation already exists from Task 2)

```bash
pnpm vitest run tests/ipc/auth.test.ts
```

Expected: PASS (license-cache.ts was already written)

- [ ] **Step 3: Implement auth IPC handler**

`electron/ipc/auth.ts`:
```typescript
import { ipcMain, safeStorage } from 'electron';
import { MongoClient } from 'mongodb';
import { getDatabase } from '@database/connection';
import { getCachedLicense, setCachedLicense } from '@database/queries/license-cache';

const CREDENTIALS_KEY = 'gpflow-credentials';

async function validateLicenseRemote(licenseKey: string): Promise<boolean> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI not configured');

  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'gpflow');
  const result = await db.collection('licenses').findOne({
    license_key: licenseKey,
    is_active: true,
  });
  await client.close();
  return result !== null;
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:validate-license', async (_event, { key }: { key: string }) => {
    const db = getDatabase();

    // Try remote validation first
    try {
      const isValid = await validateLicenseRemote(key);
      setCachedLicense(db, key, isValid);
      return { valid: isValid, cached: false };
    } catch {
      // Fallback to cache
      const cached = getCachedLicense(db, key);
      if (cached !== null) {
        return { valid: cached, cached: true };
      }
      return { valid: false, cached: false };
    }
  });

  ipcMain.handle('auth:save-credentials', async (_event, creds: {
    username: string;
    password: string;
    licenseKey: string;
  }) => {
    const encrypted = safeStorage.encryptString(JSON.stringify(creds));
    const { app } = await import('electron');
    const fs = await import('fs');
    const path = await import('path');
    const credPath = path.join(app.getPath('userData'), 'credentials.enc');
    fs.writeFileSync(credPath, encrypted);
  });

  ipcMain.handle('auth:login', async (_event, { username, password }: {
    username: string;
    password: string;
  }) => {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }
    // Credentials are validated during the Playwright automation login to Accurx.
    // This handler just confirms the fields are non-empty and stores them for use.
    return { success: true };
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add gpflow-desktop/electron/ipc/auth.ts gpflow-desktop/tests/ipc/auth.test.ts
git commit -m "feat: add auth IPC handlers with license validation and OS keychain storage"
```

---

## Task 5: Database IPC Handlers

**Files:**
- Create: `gpflow-desktop/electron/ipc/database.ts`

- [ ] **Step 1: Implement database IPC handlers**

`electron/ipc/database.ts`:
```typescript
import { ipcMain, dialog } from 'electron';
import { getDatabase } from '@database/connection';
import { createSchema } from '@database/schema';
import { importCsv } from '@database/csv-import';
import { getPractices } from '@database/queries/practices';
import { getSavedTemplates, saveTemplate, deleteTemplate } from '@database/queries/templates';
import { getRuns, getRunSteps } from '@database/queries/runs';

export function registerDatabaseHandlers(): void {
  // Initialize DB on first call
  const db = getDatabase();
  createSchema(db);

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

  ipcMain.handle('db:save-template', (_event, template) => {
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
```

- [ ] **Step 2: Register handlers in main.ts**

Update `electron/main.ts` to add after `createWindow()`:
```typescript
import { registerAuthHandlers } from './ipc/auth';
import { registerDatabaseHandlers } from './ipc/database';

// Inside app.whenReady().then():
registerAuthHandlers();
registerDatabaseHandlers();
```

- [ ] **Step 3: Commit**

```bash
git add gpflow-desktop/electron/ipc/database.ts gpflow-desktop/electron/main.ts
git commit -m "feat: add database IPC handlers for CSV import, practices, templates, runs"
```

---

## Task 6: Playwright Automation — Locators & Actions

**Files:**
- Create: `gpflow-desktop/automation/locators.ts`
- Create: `gpflow-desktop/automation/actions/login.ts`
- Create: `gpflow-desktop/automation/actions/create-template.ts`
- Create: `gpflow-desktop/automation/actions/delete-template.ts`
- Create: `gpflow-desktop/tests/automation/locators.test.ts`

- [ ] **Step 1: Write failing test for locator fallback**

`tests/automation/locators.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getLocatorDefinitions } from '@automation/locators';

describe('Locator Definitions', () => {
  it('defines locators for all actions', () => {
    const defs = getLocatorDefinitions();
    expect(defs.login).toBeDefined();
    expect(defs.create).toBeDefined();
    expect(defs.delete).toBeDefined();
  });

  it('each locator has at least 2 fallback strategies', () => {
    const defs = getLocatorDefinitions();
    for (const [action, locators] of Object.entries(defs)) {
      for (const [element, strategies] of Object.entries(locators as Record<string, string[]>)) {
        expect(strategies.length, `${action}.${element} needs >= 2 strategies`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/automation/locators.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement locator definitions**

`automation/locators.ts`:
```typescript
export interface LocatorDefinitions {
  [action: string]: Record<string, string[]>;
}

export function getLocatorDefinitions(): LocatorDefinitions {
  return {
    login: {
      emailInput: [
        'getByLabel("Email")',
        'css=input#user-email',
        'css=input[type="email"]',
      ],
      passwordInput: [
        'getByLabel("Password")',
        'css=input#user-password',
        'css=input[type="password"]',
      ],
      submitButton: [
        'getByRole("button", { name: /log in|sign in/i })',
        'css=button[type="submit"]',
      ],
    },
    create: {
      createLink: [
        'getByRole("link", { name: /create template/i })',
        'getByText("Create template")',
        'css=a[href*="templates/create"]',
      ],
      templateNameInput: [
        'getByLabel("Template name")',
        'css=#templateName',
        'css=input[name="templateName"]',
      ],
      messageInput: [
        'getByLabel("Message")',
        'css=#message',
        'css=textarea[name="message"]',
      ],
      individualCheckbox: [
        'getByLabel("Individual")',
        'css=#sendViaIndividualMessaging',
      ],
      batchCheckbox: [
        'getByLabel("Batch")',
        'css=#sendViaBatchMessaging',
      ],
      allowRespondCheckbox: [
        'getByLabel(/allow patients to respond/i)',
        'css=#allowPatientsToRespond',
      ],
      saveButton: [
        'getByRole("button", { name: /save/i })',
        'css=button[type="submit"]',
      ],
    },
    delete: {
      templateRow: [
        'getByRole("row", { name: "${templateName}" })',
        'xpath=//tr[th[@scope="row" and normalize-space()="${templateName}"]]',
      ],
      deleteButton: [
        'getByRole("button", { name: /delete/i })',
        'xpath=.//button[contains(., "Delete")]',
      ],
      confirmDeleteButton: [
        'getByRole("button", { name: /delete/i }).within(getByRole("dialog"))',
        'xpath=//div[@role="dialog"]//button[span[text()="Delete"]]',
      ],
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/automation/locators.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement login action**

`automation/actions/login.ts`:
```typescript
import type { Page } from 'playwright-core';

const LOGIN_URL = 'https://web.accurx.com/login?product=2&showLoginForm=true';
const INBOX_URL = 'https://web.accurx.com/inbox/w';
const TWO_FACTOR_URL = 'https://web.accurx.com/two-factor-auth';

export interface LoginResult {
  success: boolean;
  requires2fa: boolean;
  error?: string;
}

export async function loginToAccurx(
  page: Page,
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    // Check if already logged in
    if (page.url().includes(INBOX_URL)) {
      return { success: true, requires2fa: false };
    }

    // Fill login form
    const emailInput = page.getByLabel('Email').or(page.locator('#user-email'));
    await emailInput.fill(username);

    const passwordInput = page.getByLabel('Password').or(page.locator('#user-password'));
    await passwordInput.fill(password);

    const submitButton = page.getByRole('button', { name: /log in|sign in/i })
      .or(page.locator('button[type="submit"]'));
    await submitButton.click();

    // Wait for navigation
    await page.waitForURL((url) => {
      const href = url.toString();
      return href.includes(INBOX_URL) || href.includes(TWO_FACTOR_URL);
    }, { timeout: 15000 });

    // Check for 2FA
    if (page.url().includes(TWO_FACTOR_URL)) {
      return { success: false, requires2fa: true };
    }

    // Wait for inbox to fully load
    await page.waitForSelector('[data-userflow-id="navigation-inbox-link"]', { timeout: 10000 });

    return { success: true, requires2fa: false };
  } catch (error) {
    return {
      success: false,
      requires2fa: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function waitFor2faCompletion(page: Page, timeoutMs = 300000): Promise<boolean> {
  try {
    await page.waitForURL((url) => url.toString().includes(INBOX_URL), {
      timeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Implement create template action**

`automation/actions/create-template.ts`:
```typescript
import type { Page } from 'playwright-core';
import type { TemplateConfig } from '@/lib/types';

export interface CreateTemplateResult {
  success: boolean;
  alreadyExists: boolean;
  error?: string;
}

export async function createTemplate(
  page: Page,
  template: TemplateConfig,
): Promise<CreateTemplateResult> {
  try {
    // Check if template already exists
    const existingRow = page.locator(`tr:has(th:text-is("${template.template_name}"))`);
    const exists = await existingRow.count() > 0;

    if (exists) {
      return { success: false, alreadyExists: true };
    }

    // Click create template link
    const createLink = page.getByRole('link', { name: /create template/i })
      .or(page.locator('a[href*="templates/create"]'));
    await createLink.click();

    // Wait for form
    const nameInput = page.getByLabel(/template name/i).or(page.locator('#templateName'));
    await nameInput.waitFor({ state: 'visible' });

    // Fill form
    await nameInput.fill(template.template_name);

    const messageInput = page.getByLabel(/message/i).or(page.locator('#message'));
    await messageInput.fill(template.message);

    // Handle checkboxes
    await setCheckbox(page, '#sendViaIndividualMessaging', template.individual);
    await setCheckbox(page, '#sendViaBatchMessaging', template.batch);
    await setCheckbox(page, '#allowPatientsToRespond', template.allow_respond);

    // Save
    const saveButton = page.getByRole('button', { name: /save/i })
      .or(page.locator('button[type="submit"]'));
    await saveButton.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    return { success: true, alreadyExists: false };
  } catch (error) {
    return {
      success: false,
      alreadyExists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function setCheckbox(page: Page, selector: string, shouldBeChecked: boolean): Promise<void> {
  const checkbox = page.locator(selector);
  const isChecked = await checkbox.getAttribute('aria-checked') === 'true';
  if (isChecked !== shouldBeChecked) {
    await checkbox.click();
  }
}
```

- [ ] **Step 7: Implement delete template action**

`automation/actions/delete-template.ts`:
```typescript
import type { Page } from 'playwright-core';

export interface DeleteTemplateResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

export async function deleteTemplate(
  page: Page,
  templateName: string,
): Promise<DeleteTemplateResult> {
  try {
    const rows = page.locator(`tr:has(th:text-is("${templateName}"))`);
    const count = await rows.count();

    if (count === 0) {
      return { success: false, deletedCount: 0, error: `No template "${templateName}" found` };
    }

    let deleted = 0;

    for (let i = 0; i < count; i++) {
      // Always get first match since previous ones get removed
      const row = rows.first();

      const deleteBtn = row.getByRole('button', { name: /delete/i });
      await deleteBtn.click();

      // Confirm in dialog
      const dialog = page.getByRole('dialog');
      const confirmBtn = dialog.getByRole('button', { name: /delete/i });
      await confirmBtn.click();

      // Wait for row to disappear
      await row.waitFor({ state: 'detached', timeout: 10000 });
      deleted++;
    }

    return { success: true, deletedCount: deleted };
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add gpflow-desktop/automation/ gpflow-desktop/tests/automation/
git commit -m "feat: add Playwright automation actions with resilient locators"
```

---

## Task 7: Automation Runner & Change Detection

**Files:**
- Create: `gpflow-desktop/automation/runner.ts`
- Create: `gpflow-desktop/automation/change-detection.ts`
- Create: `gpflow-desktop/automation/screenshots.ts`
- Create: `gpflow-desktop/tests/automation/change-detection.test.ts`

- [ ] **Step 1: Write failing test for change detection**

`tests/automation/change-detection.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { diffSnapshots, hashDom } from '@automation/change-detection';

describe('Change Detection', () => {
  it('detects no changes for identical snapshots', () => {
    const snapshot = { selectors: { emailInput: ['#email'] }, domHash: 'abc123' };
    const diff = diffSnapshots(snapshot, snapshot);
    expect(diff.changed).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it('detects selector changes', () => {
    const old = { selectors: { emailInput: ['#email', 'input[type=email]'] }, domHash: 'abc' };
    const current = { selectors: { emailInput: ['#user-email', 'input[type=email]'] }, domHash: 'abc' };
    const diff = diffSnapshots(old, current);
    expect(diff.changed).toBe(true);
    expect(diff.changes).toContainEqual({
      element: 'emailInput',
      type: 'selector_changed',
      old: '#email',
      new: '#user-email',
    });
  });

  it('detects DOM hash changes', () => {
    const old = { selectors: {}, domHash: 'abc123' };
    const current = { selectors: {}, domHash: 'def456' };
    const diff = diffSnapshots(old, current);
    expect(diff.changed).toBe(true);
  });

  it('produces consistent hashes for same input', () => {
    const html = '<div id="main"><button>Click</button></div>';
    expect(hashDom(html)).toBe(hashDom(html));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/automation/change-detection.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement change detection**

`automation/change-detection.ts`:
```typescript
import crypto from 'crypto';

export interface SnapshotData {
  selectors: Record<string, string[]>;
  domHash: string;
}

export interface ChangeDetail {
  element: string;
  type: 'selector_changed' | 'selector_added' | 'selector_removed';
  old?: string;
  new?: string;
}

export interface DiffResult {
  changed: boolean;
  domHashChanged: boolean;
  changes: ChangeDetail[];
}

export function hashDom(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex');
}

export function diffSnapshots(old: SnapshotData, current: SnapshotData): DiffResult {
  const changes: ChangeDetail[] = [];
  const domHashChanged = old.domHash !== current.domHash;

  const allElements = new Set([
    ...Object.keys(old.selectors),
    ...Object.keys(current.selectors),
  ]);

  for (const element of allElements) {
    const oldSelectors = old.selectors[element];
    const currentSelectors = current.selectors[element];

    if (!oldSelectors && currentSelectors) {
      changes.push({ element, type: 'selector_added', new: currentSelectors[0] });
    } else if (oldSelectors && !currentSelectors) {
      changes.push({ element, type: 'selector_removed', old: oldSelectors[0] });
    } else if (oldSelectors && currentSelectors) {
      // Compare primary selectors
      if (oldSelectors[0] !== currentSelectors[0]) {
        changes.push({
          element,
          type: 'selector_changed',
          old: oldSelectors[0],
          new: currentSelectors[0],
        });
      }
    }
  }

  return {
    changed: domHashChanged || changes.length > 0,
    domHashChanged,
    changes,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/automation/change-detection.test.ts
```

Expected: PASS

- [ ] **Step 5: Implement screenshot utility**

`automation/screenshots.ts`:
```typescript
import type { Page } from 'playwright-core';
import path from 'path';
import fs from 'fs';

export type ScreenshotMode = 'off' | 'on-failure' | 'every-step';

export async function captureScreenshot(
  page: Page,
  basePath: string,
  runId: number,
  stepIndex: number,
  label: string,
): Promise<string> {
  const dir = path.join(basePath, String(runId));
  fs.mkdirSync(dir, { recursive: true });

  const filename = `step-${stepIndex}-${label}.png`;
  const filepath = path.join(dir, filename);

  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

export function cleanupOldScreenshots(basePath: string, retentionDays = 30): void {
  if (!fs.existsSync(basePath)) return;

  const now = Date.now();
  const cutoff = retentionDays * 24 * 60 * 60 * 1000;

  for (const dir of fs.readdirSync(basePath)) {
    const dirPath = path.join(basePath, dir);
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory() && now - stat.mtimeMs > cutoff) {
      fs.rmSync(dirPath, { recursive: true });
    }
  }
}
```

- [ ] **Step 6: Implement the automation runner**

`automation/runner.ts`:
```typescript
import { chromium, type Browser, type Page } from 'playwright-core';
import type { BrowserWindow } from 'electron';
import type { TemplateConfig, Practice } from '@/lib/types';
import type Database from 'better-sqlite3';
import { loginToAccurx, waitFor2faCompletion } from './actions/login';
import { createTemplate } from './actions/create-template';
import { deleteTemplate } from './actions/delete-template';
import { captureScreenshot, type ScreenshotMode } from './screenshots';
import { hashDom, diffSnapshots, type SnapshotData } from './change-detection';
import { createRun, updateRunStep, completeRun, getRunSteps } from '@database/queries/runs';
import { getPracticeById } from '@database/queries/practices';
import { saveSnapshot, getCurrentSnapshot } from '@database/queries/snapshots';
import path from 'path';

// Dynamically imported to avoid crashes in worker/test contexts
const { app, powerSaveBlocker } = require('electron');

const BASE_TEMPLATE_URL = 'https://web.accurx.com/w/{id}/settings/templates?tab=OrganisationTemplates';

interface RunConfig {
  type: 'create' | 'delete';
  templateConfig: TemplateConfig;
  practiceIds: number[];
  screenshotMode: ScreenshotMode;
  credentials: { username: string; password: string };
}

export class AutomationRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cancelled = false;
  private powerSaveId: number | null = null;
  private mainWindow: BrowserWindow;
  private db: Database.Database;

  constructor(mainWindow: BrowserWindow, db: Database.Database) {
    this.mainWindow = mainWindow;
    this.db = db;
  }

  async run(config: RunConfig): Promise<number> {
    this.cancelled = false;
    this.powerSaveId = powerSaveBlocker.start('prevent-display-sleep');

    const runId = createRun(this.db, config.type, config.templateConfig, config.practiceIds);
    const steps = getRunSteps(this.db, runId);
    const screenshotPath = path.join(app.getPath('userData'), 'screenshots');

    try {
      // Launch browser with bundled Chromium
      this.browser = await chromium.launch({
        headless: false,
        channel: undefined, // Uses bundled Chromium
      });
      this.page = await this.browser.newPage();

      // Login
      const loginResult = await loginToAccurx(
        this.page,
        config.credentials.username,
        config.credentials.password,
      );

      if (loginResult.requires2fa) {
        this.mainWindow.webContents.send('automation:2fa-required', { runId });
        const completed = await waitFor2faCompletion(this.page);
        if (!completed) {
          throw new Error('2FA timeout — user did not complete within 5 minutes');
        }
      } else if (!loginResult.success) {
        throw new Error(`Login failed: ${loginResult.error}`);
      }

      // Process each practice
      for (let i = 0; i < steps.length; i++) {
        if (this.cancelled) {
          // Mark remaining as cancelled
          for (let j = i; j < steps.length; j++) {
            updateRunStep(this.db, steps[j].id, 'cancelled');
          }
          break;
        }

        const step = steps[i];
        const practice = getPracticeById(this.db, step.practice_id);
        if (!practice) {
          updateRunStep(this.db, step.id, 'skipped', 'Practice not found');
          continue;
        }

        const url = BASE_TEMPLATE_URL.replace('{id}', practice.accurx_id);
        const result = await this.processOnePractice(
          config, url, practice, step.id, i, screenshotPath,
        );

        // Emit progress
        this.mainWindow.webContents.send('automation:progress', {
          runId,
          step: i + 1,
          total: steps.length,
          practice: practice.name,
          status: result.status,
          screenshotPath: result.screenshotPath,
          timestamp: new Date().toISOString(),
        });
      }

      completeRun(this.db, runId);

      // Emit completion
      const finalRun = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as any;
      this.mainWindow.webContents.send('automation:complete', {
        runId,
        summary: {
          totalCount: finalRun.total_count,
          successCount: finalRun.success_count,
          failCount: finalRun.fail_count,
          duration: new Date(finalRun.completed_at).getTime() - new Date(finalRun.started_at).getTime(),
        },
      });

      return runId;
    } catch (error) {
      this.db.prepare('UPDATE runs SET status = ?, completed_at = datetime("now") WHERE id = ?')
        .run('failed', runId);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async processOnePractice(
    config: RunConfig,
    url: string,
    practice: Practice,
    stepId: number,
    stepIndex: number,
    screenshotPath: string,
    attempt = 1,
  ): Promise<{ status: string; screenshotPath?: string }> {
    try {
      await this.page!.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      let success: boolean;

      if (config.type === 'create') {
        const result = await createTemplate(this.page!, config.templateConfig);
        success = result.success || result.alreadyExists;
        if (result.alreadyExists) {
          updateRunStep(this.db, stepId, 'skipped', 'Template already exists');
          return { status: 'skipped' };
        }
      } else {
        const result = await deleteTemplate(this.page!, config.templateConfig.template_name);
        success = result.success;
      }

      if (success) {
        // Capture snapshot for change detection
        const domContent = await this.page!.content();
        const currentHash = hashDom(domContent);
        const previousSnapshot = getCurrentSnapshot(this.db, config.type);

        if (previousSnapshot) {
          const currentSnapshot: SnapshotData = {
            selectors: {},
            domHash: currentHash,
          };
          const diff = diffSnapshots(
            { selectors: JSON.parse(previousSnapshot.selectors as any), domHash: previousSnapshot.dom_hash },
            currentSnapshot,
          );
          if (diff.changed) {
            this.mainWindow.webContents.send('automation:change-detected', {
              action: config.type,
              changes: diff.changes,
              domHashChanged: diff.domHashChanged,
            });
          }
        }

        saveSnapshot(this.db, config.type, {}, currentHash);

        let ssPath: string | undefined;
        if (config.screenshotMode === 'every-step') {
          ssPath = await captureScreenshot(this.page!, screenshotPath, 0, stepIndex, practice.name);
        }

        updateRunStep(this.db, stepId, 'success', undefined, ssPath);
        return { status: 'success', screenshotPath: ssPath };
      }

      throw new Error('Action returned failure');
    } catch (error) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000));
        return this.processOnePractice(config, url, practice, stepId, stepIndex, screenshotPath, 2);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);

      let ssPath: string | undefined;
      if (config.screenshotMode !== 'off') {
        try {
          ssPath = await captureScreenshot(this.page!, screenshotPath, 0, stepIndex, `${practice.name}-error`);
        } catch { /* ignore screenshot failure */ }
      }

      updateRunStep(this.db, stepId, 'failed', errorMsg, ssPath);
      return { status: 'failed', screenshotPath: ssPath };
    }
  }

  stop(): void {
    this.cancelled = true;
  }

  private async cleanup(): Promise<void> {
    if (this.powerSaveId !== null) {
      powerSaveBlocker.stop(this.powerSaveId);
      this.powerSaveId = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add gpflow-desktop/automation/
git commit -m "feat: add automation runner with change detection and screenshot capture"
```

---

## Task 8: Automation IPC Handlers

**Files:**
- Create: `gpflow-desktop/electron/ipc/automation.ts`
- Modify: `gpflow-desktop/electron/main.ts`

- [ ] **Step 1: Implement automation IPC**

`electron/ipc/automation.ts`:
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import { AutomationRunner } from '@automation/runner';
import { getFailedPracticeIds, createRun } from '@database/queries/runs';
import type { ScreenshotMode } from '@automation/screenshots';

let activeRunner: AutomationRunner | null = null;

export function registerAutomationHandlers(mainWindow: BrowserWindow, db: Database.Database): void {
  ipcMain.handle('automation:start', async (_event, config: {
    type: 'create' | 'delete';
    templateConfig: any;
    practiceIds: number[];
    screenshotMode: ScreenshotMode;
    credentials: { username: string; password: string };
  }) => {
    if (activeRunner) {
      throw new Error('A run is already in progress');
    }

    activeRunner = new AutomationRunner(mainWindow, db);

    try {
      const runId = await activeRunner.run({
        type: config.type,
        templateConfig: config.templateConfig,
        practiceIds: config.practiceIds,
        screenshotMode: config.screenshotMode,
        credentials: config.credentials,
      });
      return { runId };
    } finally {
      activeRunner = null;
    }
  });

  ipcMain.handle('automation:stop', async (_event, { runId }: { runId: number }) => {
    if (activeRunner) {
      activeRunner.stop();
    }
  });

  ipcMain.handle('automation:retry-failed', async (_event, { runId }: { runId: number }) => {
    const failedIds = getFailedPracticeIds(db, runId);
    if (failedIds.length === 0) {
      throw new Error('No failed practices to retry');
    }
    // Return the failed IDs so the renderer can start a new run with them
    return { practiceIds: failedIds };
  });

  ipcMain.handle('automation:2fa-continue', async () => {
    // The runner's waitFor2faCompletion is watching the page URL.
    // This is a no-op signal — 2FA completion is detected by URL change.
  });
}
```

- [ ] **Step 2: Update main.ts to wire everything together**

`electron/main.ts` — final version:
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerAuthHandlers } from './ipc/auth';
import { registerDatabaseHandlers } from './ipc/database';
import { registerAutomationHandlers } from './ipc/automation';
import { getDatabase, closeDatabase } from '@database/connection';
import { createSchema } from '@database/schema';
import { cleanupOldScreenshots } from '@automation/screenshots';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'GP Flow',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../.next/out/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize database
  const db = getDatabase();
  createSchema(db);

  createWindow();

  // Register IPC handlers
  registerAuthHandlers();
  registerDatabaseHandlers();
  registerAutomationHandlers(mainWindow!, db);

  // Cleanup old screenshots on startup
  const screenshotPath = path.join(app.getPath('userData'), 'screenshots');
  cleanupOldScreenshots(screenshotPath);
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 3: Commit**

```bash
git add gpflow-desktop/electron/
git commit -m "feat: add automation IPC handlers and wire up main process"
```

---

## Task 9: UI — Reusable Components

**Files:**
- Create: `gpflow-desktop/src/components/ui/Button.tsx`
- Create: `gpflow-desktop/src/components/ui/Input.tsx`
- Create: `gpflow-desktop/src/components/ui/Card.tsx`
- Create: `gpflow-desktop/src/components/ui/Badge.tsx`
- Create: `gpflow-desktop/src/components/ui/Tabs.tsx`
- Create: `gpflow-desktop/src/components/ui/ProgressBar.tsx`

- [ ] **Step 1: Create Button component**

`src/components/ui/Button.tsx`:
```tsx
import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50',
  danger: 'bg-error text-white hover:bg-red-600',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Create Input component**

`src/components/ui/Input.tsx`:
```tsx
import { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
          error ? 'border-error' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create Card, Badge, Tabs, ProgressBar**

`src/components/ui/Card.tsx`:
```tsx
import { type HTMLAttributes } from 'react';

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}
```

`src/components/ui/Badge.tsx`:
```tsx
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const variants = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
```

`src/components/ui/Tabs.tsx`:
```tsx
'use client';

import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  return (
    <div>
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </div>
  );
}
```

`src/components/ui/ProgressBar.tsx`:
```tsx
interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ current, total, className = '' }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-sm text-gray-600">
        <span>{current} / {total}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add gpflow-desktop/src/components/ui/
git commit -m "feat: add reusable UI components (Button, Input, Card, Badge, Tabs, ProgressBar)"
```

---

## Task 10: UI — Login Screen

**Files:**
- Create: `gpflow-desktop/src/components/LoginForm.tsx`
- Create: `gpflow-desktop/src/components/LicenseValidator.tsx`
- Create: `gpflow-desktop/src/hooks/useIpc.ts`
- Create: `gpflow-desktop/src/lib/ipc-client.ts`
- Modify: `gpflow-desktop/src/app/page.tsx`

- [ ] **Step 1: Create IPC client and hook**

`src/lib/ipc-client.ts`:
```typescript
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
```

`src/hooks/useIpc.ts`:
```typescript
'use client';

import { useState, useCallback } from 'react';

export function useIpc<TArgs extends any[], TResult>(
  fn: ((...args: TArgs) => Promise<TResult>) | undefined,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    if (!fn) {
      setError('Not running in Electron');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { execute, loading, error };
}
```

- [ ] **Step 2: Create LicenseValidator component**

`src/components/LicenseValidator.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ipc } from '@/lib/ipc-client';

interface LicenseValidatorProps {
  onValidated: (valid: boolean) => void;
  initialKey?: string;
}

export function LicenseValidator({ onValidated, initialKey = '' }: LicenseValidatorProps) {
  const [licenseKey, setLicenseKey] = useState(initialKey);
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [cached, setCached] = useState(false);

  const validate = async () => {
    if (!licenseKey.trim() || !ipc) return;
    setStatus('checking');
    const result = await ipc.validateLicense(licenseKey.trim());
    setStatus(result.valid ? 'valid' : 'invalid');
    setCached(result.cached);
    onValidated(result.valid);
  };

  useEffect(() => {
    if (initialKey) validate();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label="License Key"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Enter your license key"
          />
        </div>
        <div className="flex items-end">
          <Button variant="secondary" onClick={validate} disabled={status === 'checking'}>
            {status === 'checking' ? 'Checking...' : 'Validate'}
          </Button>
        </div>
      </div>
      {status === 'valid' && (
        <Badge variant="success">
          License Active {cached && '(cached)'}
        </Badge>
      )}
      {status === 'invalid' && (
        <Badge variant="error">License Invalid</Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create LoginForm component**

`src/components/LoginForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { LicenseValidator } from './LicenseValidator';
import { ipc } from '@/lib/ipc-client';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [licenseValid, setLicenseValid] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    if (!licenseValid) {
      setError('Please validate your license key first');
      return;
    }

    if (ipc) {
      await ipc.saveCredentials({ username, password, licenseKey: '' });
    }
    onSuccess();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">GP Flow</h1>
        <p className="mt-2 text-gray-500">Automate Your Accurx Templates</p>
      </div>

      <Card className="w-full max-w-md p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your Accurx username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          <LicenseValidator onValidated={setLicenseValid} />

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-gray-400">Version 8.0.0</p>
    </div>
  );
}
```

- [ ] **Step 4: Update login page**

`src/app/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  return (
    <LoginForm onSuccess={() => router.push('/data')} />
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add gpflow-desktop/src/
git commit -m "feat: add login screen with license validation"
```

---

## Task 11: UI — Data Preview Screen

**Files:**
- Create: `gpflow-desktop/src/components/DataTable.tsx`
- Create: `gpflow-desktop/src/components/CsvImporter.tsx`
- Create: `gpflow-desktop/src/app/data/page.tsx`

- [ ] **Step 1: Create DataTable component**

`src/components/DataTable.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { Practice } from '@/lib/types';

interface DataTableProps {
  practices: Practice[];
  onSelectionChange: (ids: number[]) => void;
}

export function DataTable({ practices, onSelectionChange }: DataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');

  const filtered = practices.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.accurx_id.includes(filter)
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = (a as any)[sortField] || '';
    const bVal = (b as any)[sortField] || '';
    return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const toggleAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
      onSelectionChange([]);
    } else {
      const all = new Set(sorted.map((p) => p.id));
      setSelectedIds(all);
      onSelectionChange([...all]);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    onSelectionChange([...next]);
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search practices..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="overflow-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">
                <input type="checkbox" onChange={toggleAll} checked={selectedIds.size === sorted.length && sorted.length > 0} />
              </th>
              <th className="p-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                Name {sortField === 'name' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('accurx_id')}>
                Accurx ID {sortField === 'accurx_id' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-3 text-left">Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((practice) => (
              <tr key={practice.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3">
                  <input type="checkbox" checked={selectedIds.has(practice.id)} onChange={() => toggleOne(practice.id)} />
                </td>
                <td className="p-3">{practice.name}</td>
                <td className="p-3 font-mono text-xs">{practice.accurx_id}</td>
                <td className="p-3 text-gray-500">{practice.source_file}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500">{selectedIds.size} of {sorted.length} selected</p>
    </div>
  );
}
```

- [ ] **Step 2: Create CsvImporter component**

`src/components/CsvImporter.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ipc } from '@/lib/ipc-client';

interface CsvImporterProps {
  onImported: () => void;
}

export function CsvImporter({ onImported }: CsvImporterProps) {
  const [result, setResult] = useState<{ rowCount: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!ipc) return;
    setLoading(true);
    const res = await ipc.importCsv();
    setResult(res);
    setLoading(false);
    if (res.rowCount > 0) onImported();
  };

  return (
    <div className="flex items-center gap-4">
      <Button variant="secondary" onClick={handleImport} disabled={loading}>
        {loading ? 'Importing...' : 'Import CSV'}
      </Button>
      {result && (
        <div className="flex items-center gap-2">
          <Badge variant={result.rowCount > 0 ? 'success' : 'error'}>
            {result.rowCount} records imported
          </Badge>
          {result.errors.length > 0 && (
            <Badge variant="warning">{result.errors.length} warnings</Badge>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create Data Preview page**

`src/app/data/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/DataTable';
import { CsvImporter } from '@/components/CsvImporter';
import { ipc } from '@/lib/ipc-client';
import type { Practice } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function DataPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const router = useRouter();

  const loadPractices = async () => {
    if (!ipc) return;
    const data = await ipc.getPractices();
    setPractices(data);
  };

  useEffect(() => { loadPractices(); }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Preview</h1>
          <p className="text-gray-500">{practices.length} practices loaded</p>
        </div>
        <div className="flex gap-3">
          <CsvImporter onImported={loadPractices} />
          <Button
            onClick={() => {
              sessionStorage.setItem('selectedPracticeIds', JSON.stringify(selectedIds));
              router.push('/templates');
            }}
            disabled={selectedIds.length === 0}
          >
            Continue with {selectedIds.length} selected
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <DataTable practices={practices} onSelectionChange={setSelectedIds} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add gpflow-desktop/src/components/DataTable.tsx gpflow-desktop/src/components/CsvImporter.tsx gpflow-desktop/src/app/data/
git commit -m "feat: add data preview screen with CSV import and practice selection"
```

---

## Task 12: UI — Template Config Screen

**Files:**
- Create: `gpflow-desktop/src/components/TemplateForm.tsx`
- Create: `gpflow-desktop/src/app/templates/page.tsx`

- [ ] **Step 1: Create TemplateForm component**

`src/components/TemplateForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import type { TemplateConfig } from '@/lib/types';

interface TemplateFormProps {
  mode: 'create' | 'delete';
  onSubmit: (config: TemplateConfig) => void;
  practiceCount: number;
}

export function TemplateForm({ mode, onSubmit, practiceCount }: TemplateFormProps) {
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [individual, setIndividual] = useState(true);
  const [batch, setBatch] = useState(false);
  const [allowRespond, setAllowRespond] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      template_name: templateName,
      message,
      individual,
      batch,
      allow_respond: allowRespond,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Template Name *"
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        placeholder="Enter template name"
        required
      />

      {mode === 'create' && (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Message Body *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter the template message"
              required
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Template Options</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={individual} onChange={(e) => setIndividual(e.target.checked)} className="rounded" />
              <span className="text-sm">Individual messaging</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} className="rounded" />
              <span className="text-sm">Batch messaging</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowRespond} onChange={(e) => setAllowRespond(e.target.checked)} className="rounded" />
              <span className="text-sm">Allow patients to respond</span>
            </label>
          </div>
        </>
      )}

      <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        Will {mode} template "{templateName || '...'}" across <strong>{practiceCount}</strong> selected practices
      </div>

      <Button type="submit" className="w-full">
        {mode === 'create' ? 'Bulk Create Template' : 'Bulk Delete Template'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create Templates page**

`src/app/templates/page.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { TemplateForm } from '@/components/TemplateForm';
import { ipc } from '@/lib/ipc-client';
import type { TemplateConfig } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function TemplatesPage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [screenshotMode, setScreenshotMode] = useState<string>('on-failure');
  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem('selectedPracticeIds');
    if (stored) setSelectedIds(JSON.parse(stored));
  }, []);

  const startRun = async (config: TemplateConfig, type: 'create' | 'delete') => {
    if (!ipc) return;
    const { runId } = await ipc.startRun({
      templateConfig: config,
      practiceIds: selectedIds,
      screenshotMode,
    });
    router.push(`/runs?active=${runId}`);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
        <p className="text-gray-500">{selectedIds.length} practices selected</p>
      </div>

      <Card className="p-6">
        <Tabs tabs={[
          {
            id: 'create',
            label: 'Create Template',
            content: <TemplateForm mode="create" onSubmit={(c) => startRun(c, 'create')} practiceCount={selectedIds.length} />,
          },
          {
            id: 'delete',
            label: 'Delete Template',
            content: <TemplateForm mode="delete" onSubmit={(c) => startRun(c, 'delete')} practiceCount={selectedIds.length} />,
          },
        ]} />
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Screenshot Mode</p>
          <select
            value={screenshotMode}
            onChange={(e) => setScreenshotMode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="off">Off</option>
            <option value="on-failure">On failure only</option>
            <option value="every-step">Every step</option>
          </select>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add gpflow-desktop/src/components/TemplateForm.tsx gpflow-desktop/src/app/templates/
git commit -m "feat: add template config screen with create/delete tabs"
```

---

## Task 13: UI — Run Dashboard

**Files:**
- Create: `gpflow-desktop/src/hooks/useAutomationProgress.ts`
- Create: `gpflow-desktop/src/components/ProgressFeed.tsx`
- Create: `gpflow-desktop/src/components/RunHistory.tsx`
- Create: `gpflow-desktop/src/app/runs/page.tsx`

- [ ] **Step 1: Create progress event hook**

`src/hooks/useAutomationProgress.ts`:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { ipc } from '@/lib/ipc-client';
import type { ProgressEvent, RunSummary } from '@/lib/types';

export function useAutomationProgress() {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [requires2fa, setRequires2fa] = useState(false);

  useEffect(() => {
    if (!ipc) return;

    ipc.onProgress((event: ProgressEvent) => {
      setEvents((prev) => [...prev, event]);
    });

    ipc.onRunComplete((event: { summary: RunSummary }) => {
      setSummary(event.summary);
    });

    ipc.on2faRequired(() => {
      setRequires2fa(true);
    });

    return () => {
      ipc.removeAllListeners('automation:progress');
      ipc.removeAllListeners('automation:complete');
      ipc.removeAllListeners('automation:2fa-required');
    };
  }, []);

  const reset = () => {
    setEvents([]);
    setSummary(null);
    setRequires2fa(false);
  };

  return { events, summary, requires2fa, reset };
}
```

- [ ] **Step 2: Create ProgressFeed component**

`src/components/ProgressFeed.tsx`:
```tsx
'use client';

import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import type { ProgressEvent } from '@/lib/types';

interface ProgressFeedProps {
  events: ProgressEvent[];
  total: number;
}

export function ProgressFeed({ events, total }: ProgressFeedProps) {
  const current = events.length;

  return (
    <div className="space-y-4">
      <ProgressBar current={current} total={total} />
      <div className="max-h-96 overflow-y-auto space-y-2">
        {[...events].reverse().map((event, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center gap-3">
              <Badge variant={event.status === 'success' ? 'success' : event.status === 'failed' ? 'error' : 'warning'}>
                {event.status}
              </Badge>
              <span className="font-medium">{event.practice}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <span>{event.step}/{event.total}</span>
              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create RunHistory component**

`src/components/RunHistory.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ipc } from '@/lib/ipc-client';
import type { Run } from '@/lib/types';

export function RunHistory() {
  const [runs, setRuns] = useState<Run[]>([]);

  const loadRuns = async () => {
    if (!ipc) return;
    const data = await ipc.getRuns(50, 0);
    setRuns(data);
  };

  useEffect(() => { loadRuns(); }, []);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success' as const;
      case 'failed': return 'error' as const;
      case 'running': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-3">
      {runs.length === 0 && <p className="text-sm text-gray-500">No runs yet</p>}
      {runs.map((run) => (
        <Card key={run.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Run #{run.id}</span>
                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                <Badge>{run.type}</Badge>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(run.started_at).toLocaleString()} — {run.success_count} ok, {run.fail_count} failed
              </p>
            </div>
            {run.fail_count > 0 && run.status !== 'running' && (
              <Button variant="secondary" size="sm" onClick={async () => {
                if (!ipc) return;
                const { practiceIds } = await ipc.retryFailed(run.id);
                sessionStorage.setItem('selectedPracticeIds', JSON.stringify(practiceIds));
              }}>
                Retry Failed
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create Runs page**

`src/app/runs/page.tsx`:
```tsx
'use client';

import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { ProgressFeed } from '@/components/ProgressFeed';
import { RunHistory } from '@/components/RunHistory';
import { useAutomationProgress } from '@/hooks/useAutomationProgress';
import { ipc } from '@/lib/ipc-client';

export default function RunsPage() {
  const { events, summary, requires2fa } = useAutomationProgress();
  const total = events.length > 0 ? events[events.length - 1].total : 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Run Dashboard</h1>

      {requires2fa && (
        <Card className="p-4 border-warning bg-yellow-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-yellow-800">
              Two-factor authentication required. Complete 2FA in the browser window.
            </p>
            <Button size="sm" onClick={() => ipc?.continuePast2fa(0)}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {summary && (
        <Card className="p-6 bg-green-50 border-success">
          <h2 className="font-bold text-lg text-green-800">Run Complete</h2>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Total:</span> {summary.totalCount}</div>
            <div><span className="text-gray-500">Success:</span> {summary.successCount}</div>
            <div><span className="text-gray-500">Failed:</span> {summary.failCount}</div>
          </div>
        </Card>
      )}

      <Tabs tabs={[
        {
          id: 'live',
          label: 'Live Progress',
          content: (
            <Card className="p-4">
              <ProgressFeed events={events} total={total} />
            </Card>
          ),
        },
        {
          id: 'history',
          label: 'Run History',
          content: <RunHistory />,
        },
      ]} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add gpflow-desktop/src/hooks/ gpflow-desktop/src/components/ProgressFeed.tsx gpflow-desktop/src/components/RunHistory.tsx gpflow-desktop/src/app/runs/
git commit -m "feat: add run dashboard with live progress feed and run history"
```

---

## Task 14: Navigation Layout

**Files:**
- Modify: `gpflow-desktop/src/app/layout.tsx`

- [ ] **Step 1: Update root layout with sidebar navigation**

`src/app/layout.tsx`:
```tsx
'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/data', label: 'Data', icon: '📊' },
  { href: '/templates', label: 'Templates', icon: '📝' },
  { href: '/runs', label: 'Runs', icon: '▶️' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page has no nav
  if (pathname === '/') {
    return (
      <html lang="en">
        <body className="bg-gray-50 min-h-screen">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex">
        <nav className="w-56 bg-white border-r border-gray-200 p-4 space-y-1">
          <div className="px-3 py-4 mb-4">
            <h1 className="text-lg font-bold text-gray-900">GP Flow</h1>
          </div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add gpflow-desktop/src/app/layout.tsx
git commit -m "feat: add sidebar navigation layout"
```

---

## Task 15: Electron Builder Config & Packaging

**Files:**
- Create: `gpflow-desktop/electron-builder.yml`
- Modify: `gpflow-desktop/package.json` (add build scripts)

- [ ] **Step 1: Create electron-builder config**

`electron-builder.yml`:
```yaml
appId: com.gpflow.desktop
productName: GP Flow
directories:
  output: release

win:
  target: nsis
  icon: assets/icon.ico

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true

mac:
  target: dmg
  icon: assets/icon.icns
  category: public.app-category.healthcare-fitness

files:
  - dist-electron/**/*
  - .next/out/**/*
  - node_modules/**/*
  - "!node_modules/.cache"

extraResources:
  - from: playwright-browsers/
    to: browsers/
    filter:
      - "**/*"

asar: true
```

- [ ] **Step 2: Add build scripts and Playwright browser bundling to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build && next build",
    "postinstall": "PLAYWRIGHT_BROWSERS_PATH=./playwright-browsers npx playwright install chromium",
    "package:win": "pnpm build && electron-builder --win",
    "package:mac": "pnpm build && electron-builder --mac",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Note: `postinstall` downloads Chromium into `./playwright-browsers/` which electron-builder bundles via `extraResources`. At runtime, set `PLAYWRIGHT_BROWSERS_PATH` to `path.join(process.resourcesPath, 'browsers')` before launching the browser.

- [ ] **Step 3: Commit**

```bash
git add gpflow-desktop/electron-builder.yml gpflow-desktop/package.json
git commit -m "feat: add Electron Builder config for Windows and macOS packaging"
```

---

## Task 16: Integration Testing & Final Verification

**Files:**
- Create: `gpflow-desktop/tests/automation/runner.test.ts`

- [ ] **Step 1: Write integration test for run flow**

`tests/automation/runner.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSchema } from '@database/schema';
import { upsertPractices } from '@database/queries/practices';
import { createRun, getRunSteps, completeRun, getRuns } from '@database/queries/runs';

describe('Run Flow Integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    upsertPractices(db, [
      { name: 'Practice A', accurx_id: '111' },
      { name: 'Practice B', accurx_id: '222' },
    ], 'test.csv');
  });

  afterEach(() => {
    db.close();
  });

  it('creates a run with steps for each practice', () => {
    const runId = createRun(db, 'create', {
      template_name: 'Test', message: 'Hello', individual: true, batch: false, allow_respond: false,
    }, [1, 2]);

    const steps = getRunSteps(db, runId);
    expect(steps).toHaveLength(2);
    expect(steps[0].status).toBe('pending');
  });

  it('completes a run and calculates summary', () => {
    const runId = createRun(db, 'create', {
      template_name: 'Test', message: 'Hello', individual: true, batch: false, allow_respond: false,
    }, [1, 2]);

    const steps = getRunSteps(db, runId);

    db.prepare('UPDATE run_steps SET status = ? WHERE id = ?').run('success', steps[0].id);
    db.prepare('UPDATE run_steps SET status = ? WHERE id = ?').run('failed', steps[1].id);

    completeRun(db, runId);

    const runs = getRuns(db);
    expect(runs[0].success_count).toBe(1);
    expect(runs[0].fail_count).toBe(1);
    expect(runs[0].status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests PASS

- [ ] **Step 3: Verify app launches end-to-end**

```bash
pnpm run dev
```

Expected: Electron window opens, login screen renders, navigation works between screens.

- [ ] **Step 4: Commit**

```bash
git add gpflow-desktop/tests/
git commit -m "test: add integration tests for run flow"
```

- [ ] **Step 5: Final commit — verify clean state**

```bash
git status
git log --oneline -10
```

Expected: Clean working tree, all 17 tasks committed.

---

## Task 17: Structured Logging

**Files:**
- Create: `gpflow-desktop/electron/logger.ts`

- [ ] **Step 1: Implement structured JSON logger**

`electron/logger.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const RETENTION_DAYS = 30;

function getLogFilePath(): string {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `gpflow-${date}.jsonl`);
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  fs.appendFileSync(getLogFilePath(), JSON.stringify(entry) + '\n');
}

export function cleanupOldLogs(): void {
  if (!fs.existsSync(LOG_DIR)) return;
  const now = Date.now();
  const cutoff = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(LOG_DIR)) {
    const filePath = path.join(LOG_DIR, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > cutoff) {
      fs.unlinkSync(filePath);
    }
  }
}

export function getLogDir(): string {
  return LOG_DIR;
}
```

- [ ] **Step 2: Wire logger into main.ts**

Add to `app.whenReady()` in `electron/main.ts`:
```typescript
import { cleanupOldLogs } from './logger';
cleanupOldLogs();
```

- [ ] **Step 3: Commit**

```bash
git add gpflow-desktop/electron/logger.ts gpflow-desktop/electron/main.ts
git commit -m "feat: add structured JSON logging with daily rotation"
```
