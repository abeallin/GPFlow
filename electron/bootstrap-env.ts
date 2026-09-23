/**
 * Must be the FIRST import in main.ts: playwright-core resolves its browsers
 * directory when its module loads, so PLAYWRIGHT_BROWSERS_PATH has to be set
 * before anything imports the automation runner.
 */
import { app } from 'electron';
import fs from 'fs';
import { resolveBrowsersPath } from './security';

const bundled = resolveBrowsersPath({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  exists: (p) => fs.existsSync(p),
});
if (bundled && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = bundled;
}
