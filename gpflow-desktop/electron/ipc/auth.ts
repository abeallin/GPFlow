import { ipcMain, safeStorage } from 'electron';
import { MongoClient } from 'mongodb';
import { getCachedLicense, setCachedLicense } from '../../database/queries/license-cache';
import type Database from 'better-sqlite3';

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
    // Try remote validation first
    try {
      const isValid = await validateLicenseRemote(key);
      setCachedLicense(db, key, isValid);
      return { valid: isValid, cached: false };
    } catch {
      // Fallback to cache on network failure
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
    return { success: true };
  });
}
