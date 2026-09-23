import path from 'path';

/** The custom scheme the packaged renderer is served from (see main.ts). */
export const APP_ORIGIN = 'gpflow://app';

export interface OriginPolicy {
  /** Origin of the Next.js dev server when running `pnpm dev`, otherwise null. */
  devOrigin: string | null;
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // URL.origin is "null" for custom schemes in some Node versions; build it by hand.
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** May the main window navigate to `url`? Only the app's own origin (and the dev server in dev). */
export function isAllowedNavigation(url: string, policy: OriginPolicy): boolean {
  const origin = originOf(url);
  if (!origin) return false;
  if (origin === APP_ORIGIN) return true;
  if (policy.devOrigin && origin === originOf(policy.devOrigin)) return true;
  return false;
}

/** Is an IPC message from a frame we loaded ourselves? Any other frame must never reach privileged handlers. */
export function isTrustedSender(frameUrl: string | undefined, policy: OriginPolicy): boolean {
  if (!frameUrl) return false;
  return isAllowedNavigation(frameUrl, policy);
}

/**
 * Where a packaged build's bundled Playwright browsers live (electron-builder copies
 * `playwright-browsers/` to `<resources>/browsers`). Returns null to keep Playwright's
 * default cache lookup (development, or bundle missing).
 */
export function resolveBrowsersPath(opts: {
  isPackaged: boolean;
  resourcesPath: string;
  exists: (p: string) => boolean;
}): string | null {
  if (!opts.isPackaged) return null;
  const bundled = path.join(opts.resourcesPath, 'browsers');
  return opts.exists(bundled) ? bundled : null;
}
