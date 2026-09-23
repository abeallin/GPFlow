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
// cli.js is not in the package's `exports` map, so resolve it through package.json's `bin`.
const pkgJsonPath = require.resolve('playwright-core/package.json');
const cli = path.join(path.dirname(pkgJsonPath), require(pkgJsonPath).bin['playwright-core']);

const result = spawnSync(process.execPath, [cli, 'install', 'chromium'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: target },
});

if (result.status !== 0) {
  console.error('Failed to download Chromium for bundling');
  process.exit(result.status ?? 1);
}
console.log(`Chromium bundled into ${target}`);
