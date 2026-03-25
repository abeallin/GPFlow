import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let LOG_DIR = '';

export function initLogger(userDataPath: string): void {
  LOG_DIR = path.join(userDataPath, 'logs');
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getLogFilePath(): string {
  if (!LOG_DIR) {
    LOG_DIR = path.join(process.cwd(), 'logs');
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `gpflow-${date}.jsonl`);
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  fs.appendFileSync(getLogFilePath(), JSON.stringify(entry) + '\n');
}

export function cleanupOldLogs(retentionDays = 30): void {
  if (!LOG_DIR || !fs.existsSync(LOG_DIR)) return;
  const now = Date.now();
  const cutoff = retentionDays * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(LOG_DIR)) {
    const filePath = path.join(LOG_DIR, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > cutoff) {
      fs.unlinkSync(filePath);
    }
  }
}

export function getLogDir(): string {
  return LOG_DIR;
}
