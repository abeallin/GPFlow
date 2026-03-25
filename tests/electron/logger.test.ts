import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initLogger, log, cleanupOldLogs, getLogDir } from '../../electron/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Logger', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpflow-logger-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initLogger creates the logs directory', () => {
    initLogger(tmpDir);
    const logDir = getLogDir();
    expect(logDir).toBe(path.join(tmpDir, 'logs'));
    expect(fs.existsSync(logDir)).toBe(true);
  });

  it('log writes a JSONL entry to the log file', () => {
    initLogger(tmpDir);
    log('info', 'test message', { extra: 'data' });

    const logDir = getLogDir();
    const files = fs.readdirSync(logDir);
    expect(files.length).toBeGreaterThan(0);

    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    const entry = JSON.parse(content.trim().split('\n')[0]);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('test message');
    expect(entry.extra).toBe('data');
    expect(entry.timestamp).toBeDefined();
  });

  it('log appends multiple entries', () => {
    initLogger(tmpDir);
    log('info', 'first');
    log('warn', 'second');
    log('error', 'third');

    const logDir = getLogDir();
    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1]).level).toBe('warn');
  });

  it('cleanupOldLogs removes old log files', () => {
    initLogger(tmpDir);
    const logDir = getLogDir();

    // Create an old log file
    const oldFile = path.join(logDir, 'gpflow-2020-01-01.jsonl');
    fs.writeFileSync(oldFile, '{"test": true}\n');
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, sixtyDaysAgo, sixtyDaysAgo);

    cleanupOldLogs(30);

    expect(fs.existsSync(oldFile)).toBe(false);
  });

  it('cleanupOldLogs keeps recent log files', () => {
    initLogger(tmpDir);
    log('info', 'recent entry');

    const logDir = getLogDir();
    const files = fs.readdirSync(logDir);
    expect(files.length).toBeGreaterThan(0);

    cleanupOldLogs(30);

    // Recent files should still be there
    const filesAfter = fs.readdirSync(logDir);
    expect(filesAfter.length).toBeGreaterThan(0);
  });

  it('getLogDir returns the current log directory', () => {
    initLogger(tmpDir);
    expect(getLogDir()).toBe(path.join(tmpDir, 'logs'));
  });
});
