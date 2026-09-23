import './bootstrap-env'; // must stay first — see file
import { app, BrowserWindow, protocol, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { registerAuthHandlers } from './ipc/auth';
import { registerDatabaseHandlers } from './ipc/database';
import { registerAutomationHandlers, shutdownAutomation } from './ipc/automation';
import { createSchema } from '../database/schema';
import { importCsv } from '../database/csv-import';
import { cleanupOldScreenshots } from '../automation/screenshots';
import { initLogger, cleanupOldLogs, log } from './logger';
import { isAllowedNavigation, contentSecurityPolicy, inlineScriptHashes, type OriginPolicy } from './security';

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;
let importWatcher: fs.FSWatcher | null = null;

const SCHEME = 'gpflow';
const OUT_DIR = path.join(__dirname, '../out');
const DEV_ORIGIN = 'http://localhost:3000';

const isDev = process.env.NODE_ENV === 'development' || !fs.existsSync(path.join(OUT_DIR, 'index.html'));
const policy: OriginPolicy = { devOrigin: isDev ? DEV_ORIGIN : null };

// MIME types for static file serving
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

// Register custom protocol scheme (must happen before app.ready)
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getImportDir(): string {
  return path.join(app.getPath('userData'), 'imports');
}

function getProcessedDir(): string {
  return path.join(getImportDir(), 'processed');
}

function ensureImportDirs() {
  const importDir = getImportDir();
  const processedDir = getProcessedDir();
  if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
  if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
}

function autoImportCsvFiles() {
  if (!db) return;

  const importDir = getImportDir();
  const processedDir = getProcessedDir();

  const csvFiles = fs.readdirSync(importDir).filter(
    (f) => f.toLowerCase().endsWith('.csv') && fs.statSync(path.join(importDir, f)).isFile()
  );

  for (const file of csvFiles) {
    const filePath = path.join(importDir, file);
    try {
      const result = importCsv(db, filePath);
      const destPath = path.join(processedDir, `${Date.now()}_${file}`);
      fs.renameSync(filePath, destPath);
      log('info', `Auto-imported ${file}: ${result.rowCount} rows, ${result.errors.length} warnings`);

      if (result.rowCount > 0 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('db:practices-updated');
      }
    } catch (err) {
      log('error', `Auto-import of ${file} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function startImportWatcher() {
  ensureImportDirs();
  autoImportCsvFiles();

  const importDir = getImportDir();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  importWatcher = fs.watch(importDir, (_eventType, filename) => {
    if (filename && filename.toLowerCase().endsWith('.csv')) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => autoImportCsvFiles(), 500);
    }
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'GP Flow',
    backgroundColor: '#070910',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#070910',
      symbolColor: '#8B8BA3',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The preload bridge exposes credentials; never let the window navigate anywhere else.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, policy)) {
      event.preventDefault();
      log('warn', `Blocked navigation to ${url}`);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(DEV_ORIGIN);
  } else {
    win.loadURL(`${SCHEME}://app/`);
  }
  mainWindow = win;
  return win;
}

app.whenReady().then(() => {
  // Register protocol handler to serve Next.js static export
  // HTML gets a strict CSP (packaged only: the dev server needs HMR and inline scripts).
  // Next's export has inline bootstrap scripts, so each one is allowed by hash rather than
  // by 'unsafe-inline'. Assets carry no policy; only documents do.
  const htmlResponse = (file: string): Response => {
    const body = fs.readFileSync(file);
    const headers: Record<string, string> = { 'Content-Type': 'text/html' };
    if (!isDev) {
      headers['Content-Security-Policy'] = contentSecurityPolicy({
        scriptHashes: inlineScriptHashes(body.toString('utf8')),
      });
    }
    return new Response(body, { headers });
  };

  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    if (filePath.startsWith('/')) filePath = filePath.slice(1);
    if (!filePath || filePath.endsWith('/')) filePath = filePath + 'index.html';

    const fullPath = path.join(OUT_DIR, filePath);
    if (!fullPath.startsWith(OUT_DIR)) return new Response('Forbidden', { status: 403 });

    if (!fs.existsSync(fullPath)) {
      const withIndex = path.join(OUT_DIR, filePath, 'index.html');
      if (fs.existsSync(withIndex)) return htmlResponse(withIndex);
      const withHtml = fullPath + '.html';
      if (fs.existsSync(withHtml)) return htmlResponse(withHtml);
      return new Response('Not Found', { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    if (ext === '.html') return htmlResponse(fullPath);
    return new Response(fs.readFileSync(fullPath), {
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
    });
  });

  initLogger(app.getPath('userData'));
  cleanupOldLogs();

  const dbPath = path.join(app.getPath('userData'), 'gpflow.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);

  // Recover runs orphaned by a crash: their untouched steps become retryable.
  const orphaned = db.prepare(`SELECT id FROM runs WHERE status = 'running'`).all() as { id: number }[];
  for (const { id } of orphaned) {
    db.prepare(`UPDATE run_steps SET status = 'failed', error_message = 'App closed during run' WHERE run_id = ? AND status = 'pending'`).run(id);
    db.prepare(`UPDATE runs SET status = 'failed', completed_at = datetime('now') WHERE id = ?`).run(id);
  }
  if (orphaned.length) log('warn', `Recovered ${orphaned.length} orphaned run(s)`);

  const win = createWindow();

  registerAuthHandlers(db, policy);
  registerDatabaseHandlers(db, policy);
  registerAutomationHandlers(() => mainWindow, db, policy);

  ipcMain.handle('db:get-import-folder', () => getImportDir());

  startImportWatcher();
  cleanupOldScreenshots(path.join(app.getPath('userData'), 'screenshots'));

  log('info', `GP Flow started (${isDev ? 'dev' : 'packaged'}), browsers: ${process.env.PLAYWRIGHT_BROWSERS_PATH ?? 'default cache'}`);
  void win;
});

let quitting = false;
app.on('window-all-closed', async () => {
  if (quitting) return;
  quitting = true;
  // Let in-flight runs cancel and finish writing before the DB is closed.
  await shutdownAutomation();
  if (importWatcher) importWatcher.close();
  if (db) { db.close(); db = null; }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && db) createWindow();
});
