# GP Flow

**Version:** 1.0.0
**Author:** Abel Ghebrezadik
**Email:** 2percentcargoltd@gmail.com

## Overview

GP Flow is a desktop application for automating template creation and deletion in the Accurx web platform. Built with Electron, React, and Playwright, it provides a modern interface for managing templates in bulk across GP practices.

## Features

- Login with encrypted credential storage
- License key validation
- CSV import of practice data with filtering
- Create and delete Accurx templates in bulk
- Live progress feed during automation runs
- 2FA detection with pause/resume
- Screenshot capture (on-demand or on failure)
- DOM change detection for resilient automation
- Run history with detailed step-by-step results
- Local SQLite database for offline capability

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron |
| Frontend | React + Next.js (App Router) |
| Styling | Tailwind CSS |
| Automation | Playwright |
| Local DB | SQLite (better-sqlite3) |
| Remote DB | MongoDB (license validation) |
| Build | electron-vite |
| Testing | Vitest |
| Language | TypeScript (strict) |

## Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd GPFlow
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run in development:**
   ```bash
   pnpm dev
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start in development mode |
| `pnpm build` | Build for production |
| `pnpm package:win` | Package Windows installer |
| `pnpm package:mac` | Package macOS installer |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |

## Project Structure

```
GPFlow/
├── automation/          # Playwright browser automation
│   ├── actions/         # Login, create/delete template
│   ├── change-detection.ts
│   ├── locators.ts
│   ├── runner.ts
│   └── screenshots.ts
├── database/            # Data layer
│   ├── connection.ts
│   ├── csv-import.ts
│   ├── schema.ts
│   └── queries/         # CRUD operations
├── electron/            # Main process
│   ├── main.ts          # App entry point
│   ├── preload.ts       # Context bridge
│   └── ipc/             # IPC handlers
├── src/                 # React frontend
│   ├── app/             # Next.js pages (login, data, templates, runs)
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Types and utilities
├── tests/               # Vitest unit tests
└── archive/             # Legacy Python application
```

## How It Works

1. **Login** - Authenticate with Accurx, validate license key
2. **Import Data** - Upload CSV with practice data (requires `accurx_id` column)
3. **Configure Template** - Set name, message, and flags
4. **Run** - Playwright automates the browser, applying the template to each selected practice
5. **Review** - Check results in the run history dashboard

## Notes

- Credentials are encrypted using Electron's safeStorage API
- Playwright automatically installs Chromium on first setup
- The `archive/` directory contains the legacy Python/Tkinter version of the app

## Contributing

Pull requests and suggestions are welcome. Please open an issue first to discuss any major changes.

## License

This project is for internal use. Contact the author for licensing details.
