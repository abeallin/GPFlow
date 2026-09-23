import { ipcMain, safeStorage, app, type IpcMainInvokeEvent } from 'electron';
import { MongoClient } from 'mongodb';
import { getCachedLicense, setCachedLicense } from '../../database/queries/license-cache';
import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { isTrustedSender, type OriginPolicy } from '../security';

function getCredentialsDir(): string {
  return path.join(app.getPath('userData'), 'credentials');
}

function ensureCredentialsDir(): void {
  const dir = getCredentialsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function credFilePath(accountId: string): string {
  const safe = String(accountId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getCredentialsDir(), `${safe}.enc`);
}

async function validateLicenseRemote(licenseKey: string): Promise<boolean> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI not configured');

  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB || 'gpflow');
    const result = await db.collection('licenses').findOne({ license_key: licenseKey, is_active: true });
    return result !== null;
  } finally {
    await client.close().catch(() => {});
  }
}

export function registerAuthHandlers(db: Database.Database, policy: OriginPolicy): void {
  const guard = (event: IpcMainInvokeEvent) => {
    if (!isTrustedSender(event.senderFrame?.url, policy)) {
      throw new Error('Auth IPC rejected: untrusted sender');
    }
  };

  ipcMain.handle('auth:validate-license', async (event, { key }: { key: string }) => {
    guard(event);
    try {
      const isValid = await validateLicenseRemote(key);
      setCachedLicense(db, key, isValid);
      return { valid: isValid, cached: false };
    } catch {
      const cached = getCachedLicense(db, key);
      if (cached !== null) return { valid: cached, cached: true };
      return { valid: false, cached: false };
    }
  });

  // Save credentials for a specific account (encrypted with the OS keychain / DPAPI)
  ipcMain.handle('auth:save-credentials', async (event, creds: {
    accountId: string;
    username: string;
    password: string;
    licenseKey: string;
  }) => {
    guard(event);
    if (!creds?.accountId || !creds.username || !creds.password) {
      throw new Error('accountId, username and password are required');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS credential encryption is not available on this machine; password was not saved');
    }
    ensureCredentialsDir();
    const encrypted = safeStorage.encryptString(JSON.stringify({
      username: creds.username,
      password: creds.password,
      licenseKey: creds.licenseKey ?? '',
    }));
    fs.writeFileSync(credFilePath(creds.accountId), encrypted);
  });

  ipcMain.handle('auth:get-credentials', async (event, { accountId }: { accountId: string }) => {
    guard(event);
    const filePath = credFilePath(accountId);
    if (!fs.existsSync(filePath)) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS credential encryption is not available; cannot read saved password');
    }
    const decrypted = safeStorage.decryptString(fs.readFileSync(filePath));
    return JSON.parse(decrypted);
  });

  ipcMain.handle('auth:delete-credentials', async (event, { accountId }: { accountId: string }) => {
    guard(event);
    const filePath = credFilePath(accountId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  // "Logout" clears session-scoped server data only; accounts and their encrypted
  // passwords are kept (see commit fd035d7).
  ipcMain.handle('auth:logout', async (event) => {
    guard(event);
    try { db.exec('DELETE FROM license_cache'); } catch { /* ignore */ }
  });
}
