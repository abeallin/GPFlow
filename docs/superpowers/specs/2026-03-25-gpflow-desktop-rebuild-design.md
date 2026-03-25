# GPFlow Desktop Rebuild — Design Spec

## Overview

Rebuild GPFlow from a Python/Tkinter desktop app into a modern cross-platform desktop application using Electron, Next.js (React/TypeScript), and Playwright. The app automates Accurx template management (bulk create/delete) across multiple NHS practice sites.

## Goals

- Cross-platform: Windows and macOS from one codebase
- Single portable install, no admin rights required
- NHS-environment friendly: no runtime downloads, no external network required at startup
- Resilient automation that detects and logs when the target Accurx app changes
- Real-time progress visibility with optional screenshots
- Local persistence (SQLite) so data survives between sessions

## Architecture

```
┌─────────────────────────────────────┐
│  Electron Shell                     │
│  ┌───────────────────────────────┐  │
│  │  Next.js UI (React/TS)       │  │
│  │  - Login / License            │  │
│  │  - Data management (CSV+DB)   │  │
│  │  - Template config            │  │
│  │  - Live progress dashboard    │  │
│  └──────────┬────────────────────┘  │
│          IPC (typed channels)        │
│  ┌──────────┴────────────────────┐  │
│  │  Node.js Backend (Main proc)  │  │
│  │  - Playwright automation      │  │
│  │  - SQLite (better-sqlite3)    │  │
│  │  - Change detection engine    │  │
│  │  - Run history & logging      │  │
│  └───────────────────────────────┘  │
│  Bundled Chromium (Playwright)       │
└─────────────────────────────────────┘
```

- Electron main process owns Playwright and SQLite — the renderer never touches them directly
- IPC bridge with typed channels keeps the UI isolated and secure
- Live progress delivered via Electron IPC event streaming (main process pushes events to renderer via `webContents.send`), referred to as "SSE-style" for the push pattern — not HTTP-based SSE
- Automation module is self-contained for easy updates when Accurx changes
- Playwright runs in a worker thread (via `worker_threads`) to avoid blocking the main process
- Electron security: `contextIsolation: true`, `nodeIntegration: false`, strict CSP in renderer

## Project Structure

```
gpflow-desktop/
├── electron/
│   ├── main.ts              # Electron main process entry
│   ├── preload.ts            # Secure bridge between main/renderer
│   └── ipc/
│       ├── automation.ts     # Playwright automation IPC handlers
│       ├── database.ts       # SQLite IPC handlers
│       └── sse.ts            # SSE event emitter for live progress
├── src/                      # Next.js renderer (the UI)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Login screen (default route)
│   │   ├── data/page.tsx     # Data preview + CSV import
│   │   ├── templates/page.tsx # Create/Delete template config
│   │   └── runs/page.tsx     # Live run progress + history
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   ├── DataTable.tsx
│   │   ├── ProgressFeed.tsx
│   │   └── RunHistory.tsx
│   └── lib/
│       ├── ipc-client.ts     # Typed IPC calls to main process
│       └── types.ts          # Shared TypeScript types
├── automation/
│   ├── runner.ts             # Playwright orchestrator
│   ├── actions/
│   │   ├── login.ts          # Accurx login flow
│   │   ├── create-template.ts
│   │   └── delete-template.ts
│   ├── change-detection.ts   # DOM snapshot + diff engine
│   └── screenshots.ts        # Optional screenshot capture
├── database/
│   ├── schema.ts             # SQLite schema definitions
│   ├── migrations/           # Schema migrations
│   └── queries.ts            # Data access layer
├── package.json
├── electron-builder.yml      # Build config for .exe/.dmg
└── tsconfig.json
```

## Screen Flow

```
Login → Data Preview → Template Config → Run Dashboard
  │                                            │
  └──────────── Run History ◄──────────────────┘
```

### Login Screen
- Username + password fields, pre-filled from stored credentials
- License key validation with status indicator
- Credentials stored via Electron `safeStorage` API (OS keychain — Windows Credential Manager / macOS Keychain)
- Offline-capable: caches last valid license state
- License validation calls the existing MongoDB backend; if network is unavailable, trusts cached license state for up to 7 days

### Two-Factor Authentication
- After Accurx login, the app may redirect to a 2FA page
- The automation pauses and shows a prompt in the Run Dashboard: "Complete 2FA in the browser window, then click Continue"
- 5-minute timeout — if not completed, the run is cancelled with a clear message
- Once 2FA succeeds, the session is reused for all subsequent practices in the same run

### Data Preview Screen
- CSV import button — parses and upserts into SQLite
- Data table with column sorting, filtering, search
- Row selection (select all / select specific practices)
- Record count badge
- Data persists between sessions

### Template Config Screen
- Create or Delete mode via tab toggle
- Template name, message body, checkboxes (individual/batch/allow respond)
- Preview: "Will create template X across 23 selected practices"
- Save template configs for reuse (stored in SQLite `saved_templates` table)

### Run Dashboard
- Start/stop controls
- Live SSE feed: practice name, status (success/fail/skipped), timestamp
- Optional screenshot thumbnails inline (user toggle)
- Progress bar with ETA
- Summary card on completion with success/fail counts
- Run History tab with full logs from past runs

## Automation & Change Detection

### Playwright Automation
- Role/label-based selectors as primary strategy, CSS/XPath as fallback
- Auto-waiting built in — no manual sleeps or explicit waits
- Each action (login, create, delete) is its own module with a consistent interface
- Bundled Chromium ships with the app

### Change Detection Engine
On every run:
1. **Snapshot** — capture key page landmarks (selectors, DOM structure, API responses)
2. **Compare** — diff against the last known-good snapshot
3. **Log changes** — store diffs in SQLite with timestamps
4. **Alert** — surface in Run Dashboard when selectors or DOM structure shift
5. **Selector fallback chain** — each action defines primary, secondary, and tertiary locators; if primary breaks, tries next and logs a warning

```typescript
// Resilient locator with fallback chain
const createButton = await page.locator([
  page.getByRole('link', { name: /create template/i }),
  page.getByText('Create template'),
  page.locator('a[href*="templates/create"]'),
]).first();
```

### Screenshot Capture
- Toggle: off / on-failure-only / every-step
- Stored in `app.getPath('userData')/screenshots/{runId}/`
- Auto-cleanup after configurable retention (default 30 days)

### Error Handling & Retry Strategy
- **Per-practice failure**: retry once after 3 seconds. If retry fails, mark as failed, log error + screenshot, continue to next practice
- **Browser crash**: restart Playwright browser, re-authenticate (session lost), resume from the practice that failed
- **Network timeout**: 30-second timeout per navigation. On timeout, treat as per-practice failure (retry once)
- **Run cancellation**: user can stop a run at any time via the dashboard. In-progress practice completes, remaining are marked "cancelled"
- **Partial run recovery**: failed practices from a run can be retried as a new run with one click ("Retry failed")
- **Screensaver/sleep prevention**: use Electron `powerSaveBlocker.start('prevent-display-sleep')` during active runs to prevent OS lock on NHS machines with aggressive lock policies

## Data Layer

### SQLite Schema (better-sqlite3)

**practices** — imported from CSV
- id, name, accurx_id, ...dynamic CSV columns, imported_at, source_file

**runs** — every automation execution
- id, started_at, completed_at, type (create|delete), template_config (JSON), total_count, success_count, fail_count, status (running|completed|failed|cancelled)

**run_steps** — individual practice results within a run
- id, run_id (FK), practice_id (FK), status (success|failed|skipped), error_message, screenshot_path, dom_snapshot (JSON), completed_at

**page_snapshots** — known-good DOM state per action
- id, action (login|create|delete), selectors (JSON), dom_hash, captured_at, is_current

**saved_templates** — reusable template configurations
- id, name, template_name, message, individual (bool), batch (bool), allow_respond (bool), created_at, updated_at

### CSV Import & Dynamic Columns
- Fixed columns in the `practices` table: id, name, accurx_id, imported_at, source_file
- Additional CSV columns stored in a `metadata` JSON column — avoids ALTER TABLE for every CSV variation
- `accurx_id` is the Accurx workspace numeric ID used to construct URLs like `https://web.accurx.com/w/{accurx_id}/settings/templates`
- Import validates that `accurx_id` column exists and contains non-empty values

### Credentials
- Stored via Electron `safeStorage` API (OS keychain)
- Encrypted at rest, no plaintext .env files

### Logging
- Structured JSON logs written to `app.getPath('userData')/logs/`
- One log file per day, auto-rotated (keep 30 days)
- Log levels: error, warn, info, debug
- Each run step logs: action, practice, result, duration, selectors used
- Logs viewable in-app via Run History, and exportable as a file for support

## Build & Distribution

### Packaging (electron-builder)
- **Windows**: .exe installer (NSIS), installs to `%LOCALAPPDATA%`, no admin rights
- **macOS**: .dmg with drag-to-Applications
- Chromium bundled inside the app (Playwright browser binary)
- SQLite database in `app.getPath('userData')` — survives updates
- Estimated bundle size: ~180-200MB

### NHS Environment Considerations
- No runtime downloads — everything ships in the package
- No external network required at startup
- Runs from user space, not Program Files
- No background services or registry modifications
- Auto-update optional (can be disabled for IT-controlled environments)

### Dev Tooling
- pnpm for package management
- electron-vite for fast dev builds with HMR
- TypeScript strict mode throughout
- Tailwind CSS for styling
- Vitest for unit/integration tests
- Playwright Test for E2E tests against the app itself
- ESLint + Prettier for linting/formatting

## IPC Channel Contract

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `auth:login` | renderer → main | `{ username, password }` | `{ success, error? }` |
| `auth:validate-license` | renderer → main | `{ key }` | `{ valid, cached }` |
| `auth:save-credentials` | renderer → main | `{ username, password, licenseKey }` | `void` |
| `db:import-csv` | renderer → main | `{ filePath }` | `{ rowCount, errors[] }` |
| `db:get-practices` | renderer → main | `{ filters?, sort? }` | `Practice[]` |
| `db:get-saved-templates` | renderer → main | `void` | `SavedTemplate[]` |
| `db:save-template` | renderer → main | `SavedTemplate` | `{ id }` |
| `db:get-runs` | renderer → main | `{ limit?, offset? }` | `Run[]` |
| `automation:start` | renderer → main | `{ templateConfig, practiceIds[], screenshotMode }` | `{ runId }` |
| `automation:stop` | renderer → main | `{ runId }` | `void` |
| `automation:retry-failed` | renderer → main | `{ runId }` | `{ newRunId }` |
| `automation:progress` | main → renderer | `{ runId, step, total, practice, status, screenshot?, timestamp }` | — (push) |
| `automation:2fa-required` | main → renderer | `{ runId }` | — (push) |
| `automation:2fa-continue` | renderer → main | `{ runId }` | `void` |
| `automation:complete` | main → renderer | `{ runId, summary }` | — (push) |
| `automation:change-detected` | main → renderer | `{ action, oldSelector, newSelector, diff }` | — (push) |

## Testing Strategy

- **Unit tests** (Vitest): data parsing, change detection diffing, template config validation, database queries
- **Integration tests** (Vitest): IPC handlers with real SQLite, CSV import pipeline
- **E2E tests** (Playwright Test): full app flows against a mock Accurx server (local HTTP server returning expected HTML structures) — validates the automation actions work without hitting real Accurx
