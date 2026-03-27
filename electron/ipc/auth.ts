import { ipcMain, safeStorage, app } from 'electron';
import { MongoClient } from 'mongodb';
import { getCachedLicense, setCachedLicense } from '../../database/queries/license-cache';
import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function getCredentialsDir(): string {
  return path.join(app.getPath('userData'), 'credentials');
}

function ensureCredentialsDir(): void {
  const dir = getCredentialsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function credFilePath(accountId: string): string {
  // Sanitize accountId for filesystem
  const safe = accountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getCredentialsDir(), `${safe}.enc`);
}

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

export function registerAuthHandlers(db: Database.Database): void {
  ipcMain.handle('auth:validate-license', async (_event, { key }: { key: string }) => {
    try {
      const isValid = await validateLicenseRemote(key);
      setCachedLicense(db, key, isValid);
      return { valid: isValid, cached: false };
    } catch {
      const cached = getCachedLicense(db, key);
      if (cached !== null) {
        return { valid: cached, cached: true };
      }
      return { valid: false, cached: false };
    }
  });

  // Save credentials for a specific account (encrypted on OS keychain)
  ipcMain.handle('auth:save-credentials', async (_event, creds: {
    accountId: string;
    username: string;
    password: string;
    licenseKey: string;
  }) => {
    ensureCredentialsDir();
    const encrypted = safeStorage.encryptString(JSON.stringify({
      username: creds.username,
      password: creds.password,
      licenseKey: creds.licenseKey,
    }));
    fs.writeFileSync(credFilePath(creds.accountId), encrypted);
  });

  // Retrieve credentials for a specific account
  ipcMain.handle('auth:get-credentials', async (_event, { accountId }: { accountId: string }) => {
    const filePath = credFilePath(accountId);
    if (!fs.existsSync(filePath)) return null;
    const encrypted = fs.readFileSync(filePath);
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  });

  ipcMain.handle('auth:login', async (_event, { username, password }: {
    username: string;
    password: string;
  }) => {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }
    return { success: true };
  });

  ipcMain.handle('auth:logout', async () => {
    // Delete all encrypted credential files
    const dir = getCredentialsDir();
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        fs.unlinkSync(path.join(dir, file));
      }
    }

    // Also delete legacy single credentials file
    const legacyPath = path.join(app.getPath('userData'), 'credentials.enc');
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);

    // Clear database
    try {
      db.exec('DELETE FROM run_steps');
      db.exec('DELETE FROM runs');
      db.exec('DELETE FROM practices');
      db.exec('DELETE FROM license_cache');
    } catch {}
  });
}
