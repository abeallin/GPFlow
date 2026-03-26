# GP Flow

**Version:** 1.0.0
**Author:** Abel Ghebrezadik

## Overview

GP Flow automates Accurx template management across GP practices. It runs as both a **desktop app** (Electron + Playwright for browser automation) and a **web app** (for data management and configuration). Multi-account support lets you split practices across Accurx accounts and run automations in parallel.

## Features

### Multi-Account
- Add multiple Accurx accounts from the login screen
- Upload CSV files and assign each to a different account
- Duplicate detection across accounts before running
- Parallel automation — one browser per account, configurable concurrency (1-15 tabs)

### Data Management
- Drag-and-drop CSV import (supports multiple files simultaneously)
- Case-insensitive column detection (`accurx_id`, `Accurx_Id`, `Practice Name`, etc.)
- Dynamic table with all CSV columns, search, sort, clickable rows
- Per-account filtering tabs
- Data persists in localStorage across sessions

### Automation
- Bulk create and delete Accurx templates
- O(n/k) parallel processing with configurable concurrency
- Reliable cancellation — interrupts within 1-2 seconds
- 2FA detection with pause/resume
- Screenshot capture (every step or on failure only)
- DOM change detection for resilient automation
- Automatic retry with 3-second backoff

### UI
- Premium dark theme with Instrument Serif + Manrope typography
- Collapsible sidebar with state persistence
- Glassmorphic cards, staggered animations, noise texture
- Live progress feed during automation runs
- Run history dashboard with stats

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 41 |
| Frontend | React 19 + Next.js 16 (App Router, static export) |
| Styling | Tailwind CSS 4 + Framer Motion |
| Automation | Playwright (Chromium) |
| Local DB | SQLite (better-sqlite3) |
| Remote DB | MongoDB (license validation) |
| Build | electron-vite + electron-builder |
| Testing | Vitest (69 tests) |
| Language | TypeScript 6 (strict) |
| Icons | Lucide React |

## Setup

```bash
git clone https://github.com/negus14/Accurx.git
cd GPFlow
pnpm install
pnpm install:browsers   # Install Playwright Chromium
```

## Development

```bash
# Desktop app (Electron + Next.js hot-reload)
pnpm dev

# Web only (data management, no automation)
pnpm dev:next

# Run tests
pnpm test
```

## Build & Deploy

> **Important:** Always do a clean rebuild before packaging or if the app looks stale.
> The Electron app loads from `out/` (static export) and `dist-electron/` (main process).
> If either is outdated, the app won't reflect your latest changes.

```bash
# Clean rebuild (do this before packaging)
rm -rf dist-electron out .next
pnpm build

# Windows installer (NSIS)
pnpm package:win
# Output: release/GP Flow Setup 1.0.0.exe

# macOS installer (DMG)
pnpm package:mac

# Web deployment (static site)
pnpm build:web
pnpm start:web
```

### Railway / Static Hosting

Set build command to `pnpm build:web` and start command to `pnpm start:web`. The web version serves the `out/` directory. Electron-only features (automation, SQLite) are unavailable in web mode.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Desktop app with hot-reload |
| `pnpm dev:next` | Web frontend only (port 3000) |
| `pnpm dev:electron` | Electron only (needs Next.js running) |
| `pnpm build` | Production build (Electron + Next.js) |
| `pnpm build:web` | Next.js static export only |
| `pnpm start:web` | Serve static export (for deployment) |
| `pnpm package:win` | Windows NSIS installer |
| `pnpm package:mac` | macOS DMG installer |
| `pnpm install:browsers` | Install Playwright Chromium |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Tests in watch mode |

## Project Structure

```
GPFlow/
├── automation/              # Playwright browser automation
│   ├── actions/             # Login, create/delete template
│   ├── runner.ts            # Parallel runner with work queue
│   ├── work-queue.ts        # O(n/k) concurrent task distribution
│   ├── cancellation-token.ts # Cooperative cancellation primitive
│   ├── change-detection.ts  # DOM resilience
│   ├── locators.ts          # Accurx page selectors
│   └── screenshots.ts       # On-demand & failure capture
├── database/                # Data layer
│   ├── schema.ts            # SQLite tables
│   ├── csv-import.ts        # CSV parsing (case-insensitive headers)
│   └── queries/             # CRUD for practices, runs, templates
├── electron/                # Main process
│   ├── main.ts              # App entry, custom protocol, auto-import
│   ├── preload.ts           # Context bridge (IPC)
│   ├── logger.ts            # JSONL structured logging
│   └── ipc/                 # Handlers: auth, database, automation
├── src/                     # React frontend
│   ├── app/                 # Pages: login, data, templates, runs
│   ├── components/          # UI components + feature components
│   ├── hooks/               # useAutomationProgress
│   └── lib/                 # IPC client, accounts, types
├── tests/                   # 69 tests across 14 files
└── archive/                 # Legacy Python/Tkinter application
```

## How It Works

1. **Add Accounts** — Enter Accurx credentials (stored in localStorage, encrypted in Electron via safeStorage)
2. **Import Data** — Drop CSV files, assign each to an account
3. **Review & Deduplicate** — Filter by account, resolve cross-account duplicates
4. **Configure Template** — Set name, message, and messaging options
5. **Run** — Playwright opens k browser tabs per account, processes practices in parallel
6. **Monitor** — Live progress feed, 2FA handling, cancel anytime
7. **Review** — Run history with success/failure stats

## Architecture Notes

### Custom Protocol (Electron)
The packaged app serves the Next.js static export via a custom `gpflow://` protocol. This avoids `file://` issues with client-side routing and asset loading.

### Parallel Runner
The `WorkQueue` distributes N practices across k workers (browser tabs). Each worker pulls from a shared cursor — O(n/k) wall time, O(n) total work. All tabs share a single `BrowserContext` (same auth cookies from one login).

### Cancellation
`CancellationToken.race()` wraps every Playwright operation. Calling `stop()` cancels the token and closes all pages, causing in-flight operations to reject immediately. No 30-second timeout waits.

### Auto-Import (Electron)
The app watches `{userData}/imports/` for CSV files. Drop a file there and it's automatically imported and the UI refreshes. Processed files move to `imports/processed/`.

## License

This project is for internal use. Contact the author for licensing details.
