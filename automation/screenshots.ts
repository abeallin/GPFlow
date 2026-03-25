import type { Page } from 'playwright-core';
import path from 'path';
import fs from 'fs';

export type ScreenshotMode = 'off' | 'on-failure' | 'every-step';

export async function captureScreenshot(
  page: Page,
  basePath: string,
  runId: number,
  stepIndex: number,
  label: string,
): Promise<string> {
  const dir = path.join(basePath, String(runId));
  fs.mkdirSync(dir, { recursive: true });

  const filename = `step-${stepIndex}-${label}.png`;
  const filepath = path.join(dir, filename);

  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

export function cleanupOldScreenshots(basePath: string, retentionDays = 30): void {
  if (!fs.existsSync(basePath)) return;

  const now = Date.now();
  const cutoff = retentionDays * 24 * 60 * 60 * 1000;

  for (const dir of fs.readdirSync(basePath)) {
    const dirPath = path.join(basePath, dir);
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory() && now - stat.mtimeMs > cutoff) {
      fs.rmSync(dirPath, { recursive: true });
    }
  }
}
