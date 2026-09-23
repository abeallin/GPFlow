/**
 * Fetch the better-sqlite3 prebuilt binary for the installed Electron's ABI.
 * Runs on postinstall. (electron-builder's install-app-deps does not find
 * pnpm's nested layout, and a plain `pnpm install` builds for system Node.)
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

let electronVersion;
try {
  electronVersion = require('electron/package.json').version;
} catch {
  console.log('rebuild-native: electron not installed, skipping');
  process.exit(0);
}

const pkgJson = require.resolve('better-sqlite3/package.json');
const pkgDir = path.dirname(pkgJson);
// prebuild-install is a dependency of better-sqlite3, so resolve it from there (works with pnpm's layout).
const prebuildBin = createRequire(pkgJson).resolve('prebuild-install/bin.js');

const result = spawnSync(
  process.execPath,
  [prebuildBin, '--runtime=electron', `--target=${electronVersion}`, `--arch=${process.arch}`],
  { cwd: pkgDir, stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error(`rebuild-native: failed to install better-sqlite3 prebuilt for Electron ${electronVersion}`);
  process.exit(result.status ?? 1);
}
console.log(`rebuild-native: better-sqlite3 ready for Electron ${electronVersion} (${process.arch})`);
