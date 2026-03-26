import { app, BrowserWindow } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';
import { registerAuthHandlers } from './ipc/auth';
import { registerDatabaseHandlers } from './ipc/database';
import { registerAutomationHandlers } from './ipc/automation';
import { createSchema } from '../database/schema';
import { cleanupOldScreenshots } from '../automation/screenshots';
import { initLogger, cleanupOldLogs } from './logger';

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

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
    // Static export is in 'out/' at project root
    // In packaged app, __dirname = resources/app.asar/dist-electron
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }
}

app.whenReady().then(() => {
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
