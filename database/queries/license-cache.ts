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

  if (diffDays > CACHE_TTL_DAYS) return null;

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
