import path from 'path';
import { createHash } from 'crypto';

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

/**
 * Content Security Policy for HTML served from the gpflow:// scheme (packaged builds only;
 * the dev server needs inline scripts and HMR websockets, so main.ts skips it there).
 *
 * Scripts: no 'unsafe-inline'. Next's static export ships its React Server Components
 * bootstrap as two inline `<script>` blocks (`self.__next_f.push(...)`) that vary per page,
 * so the handler hashes each inline script body at serve time (see `inlineScriptHashes`)
 * and allows exactly those. Styles keep 'unsafe-inline' because the export writes
 * `style=""` attributes and `<style>` blocks that cannot be hashed.
 */
export function contentSecurityPolicy(opts: { scriptHashes?: readonly string[] } = {}): string {
  const hashes = (opts.scriptHashes ?? []).map((h) => `'${h}'`);
  const scriptSrc = ["'self'", 'gpflow:', ...hashes].join(' ');
  return [
    "default-src 'self' gpflow:",
    `script-src ${scriptSrc}`,
    "style-src 'self' gpflow: 'unsafe-inline'",
    "font-src 'self' gpflow:",
    "img-src 'self' gpflow: data:",
    "connect-src 'self' gpflow:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * CSP hash sources (`sha256-<base64>`) for every inline `<script>` in an HTML document,
 * in document order. Scripts with a `src` attribute are external and are covered by 'self'.
 * Chromium hashes the exact text between the tags, so the body is not trimmed.
 */
export function inlineScriptHashes(html: string): string[] {
  const out: string[] = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? '';
    if (/\ssrc\s*=/i.test(attrs)) continue;
    out.push('sha256-' + createHash('sha256').update(m[2], 'utf8').digest('base64'));
  }
  return out;
}
