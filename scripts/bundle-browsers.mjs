/**
 * Downloads the Playwright Chromium build into ./playwright-browsers so that
 * electron-builder can ship it (see electron-builder.yml → extraResources).
 * Run before `pnpm package:win` / `pnpm package:mac`.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'playwright-browsers');
const cli = require.resolve('playwright-core/cli.js');

const result = spawnSync(process.execPath, [cli, 'install', 'chromium'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: target },
});

if (result.status !== 0) {
  console.error('Failed to download Chromium for bundling');
  process.exit(result.status ?? 1);
}
console.log(`Chromium bundled into ${target}`);
