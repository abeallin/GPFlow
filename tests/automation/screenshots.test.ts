import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanupOldScreenshots } from '../../automation/screenshots';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Screenshots', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpflow-screenshots-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('cleanupOldScreenshots removes directories older than retention days', () => {
    // Create a subdirectory and backdate it
    const oldDir = path.join(tmpDir, '1');
    fs.mkdirSync(oldDir);
    fs.writeFileSync(path.join(oldDir, 'step-0-test.png'), 'fake');

    // Set mtime to 60 days ago
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldDir, sixtyDaysAgo, sixtyDaysAgo);

    cleanupOldScreenshots(tmpDir, 30);

    expect(fs.existsSync(oldDir)).toBe(false);
  });

  it('cleanupOldScreenshots keeps directories within retention period', () => {
    const recentDir = path.join(tmpDir, '2');
    fs.mkdirSync(recentDir);
    fs.writeFileSync(path.join(recentDir, 'step-0-test.png'), 'fake');

    cleanupOldScreenshots(tmpDir, 30);

    expect(fs.existsSync(recentDir)).toBe(true);
  });

  it('cleanupOldScreenshots handles non-existent base path', () => {
    const nonExistent = path.join(tmpDir, 'does-not-exist');
    expect(() => cleanupOldScreenshots(nonExistent)).not.toThrow();
  });

  it('cleanupOldScreenshots ignores files (only removes directories)', () => {
    const filePath = path.join(tmpDir, 'stray-file.txt');
    fs.writeFileSync(filePath, 'data');

    // Backdate the file
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(filePath, sixtyDaysAgo, sixtyDaysAgo);

    cleanupOldScreenshots(tmpDir, 30);

    // File should still exist — cleanupOldScreenshots checks isDirectory()
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
