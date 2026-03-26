import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { registerAuthHandlers } from './ipc/auth';
import { registerDatabaseHandlers } from './ipc/database';
import { registerAutomationHandlers } from './ipc/automation';
import { createSchema } from '../database/schema';
import { cleanupOldScreenshots } from '../automation/screenshots';
import { initLogger, cleanupOldLogs } from './logger';

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

const SCHEME = 'gpflow';
const OUT_DIR = path.join(__dirname, '../out');

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

function createWindow() {
  mainWindow = new BrowserWindow({
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
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`${SCHEME}://app/`);
  }
}

app.whenReady().then(() => {
  // Register protocol handler to serve Next.js static export
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    // Remove leading slash
    if (filePath.startsWith('/')) filePath = filePath.slice(1);

    // Default to index.html
    if (!filePath || filePath.endsWith('/')) {
      filePath = filePath + 'index.html';
    }

    const fullPath = path.join(OUT_DIR, filePath);

    // If file doesn't exist and no extension, try as directory with index.html
    if (!fs.existsSync(fullPath)) {
      const withIndex = path.join(OUT_DIR, filePath, 'index.html');
      if (fs.existsSync(withIndex)) {
        const ext = path.extname('index.html');
        return new Response(fs.readFileSync(withIndex), {
          headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
        });
      }

      // Try with .html extension (for routes like /data -> /data.html)
      const withHtml = fullPath + '.html';
      if (fs.existsSync(withHtml)) {
        return new Response(fs.readFileSync(withHtml), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      return new Response('Not Found', { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    return new Response(fs.readFileSync(fullPath), {
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
    });
  });

  // Initialize database
  const dbPath = path.join(app.getPath('userData'), 'gpflow.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
  initLogger(app.getPath('userData'));
  cleanupOldLogs();

  createWindow();

  // Register IPC handlers
  registerAuthHandlers(db);
  registerDatabaseHandlers(db);
  registerAutomationHandlers(mainWindow!, db);

  // Cleanup old screenshots on startup
  const screenshotPath = path.join(app.getPath('userData'), 'screenshots');
  cleanupOldScreenshots(screenshotPath);
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
