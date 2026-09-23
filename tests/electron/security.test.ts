import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { isAllowedNavigation, isTrustedSender, resolveBrowsersPath, contentSecurityPolicy, inlineScriptHashes } from '../../electron/security';

describe('isAllowedNavigation', () => {
  it('allows the packaged app origin and the dev server only', () => {
    expect(isAllowedNavigation('gpflow://app/data/', { devOrigin: null })).toBe(true);
    expect(isAllowedNavigation('http://localhost:3000/templates', { devOrigin: 'http://localhost:3000' })).toBe(true);
    expect(isAllowedNavigation('http://localhost:3000/templates', { devOrigin: null })).toBe(false);
    expect(isAllowedNavigation('https://web.accurx.com/login', { devOrigin: 'http://localhost:3000' })).toBe(false);
    expect(isAllowedNavigation('https://evil.example/steal', { devOrigin: null })).toBe(false);
    expect(isAllowedNavigation('file:///C:/Windows/system.ini', { devOrigin: null })).toBe(false);
    expect(isAllowedNavigation('not a url', { devOrigin: null })).toBe(false);
  });
});

describe('isTrustedSender', () => {
  it('only trusts frames loaded from the app itself', () => {
    expect(isTrustedSender('gpflow://app/', { devOrigin: null })).toBe(true);
    expect(isTrustedSender('http://localhost:3000/', { devOrigin: 'http://localhost:3000' })).toBe(true);
    expect(isTrustedSender('https://web.accurx.com/inbox', { devOrigin: 'http://localhost:3000' })).toBe(false);
    expect(isTrustedSender(undefined, { devOrigin: null })).toBe(false);
  });
});

describe('resolveBrowsersPath', () => {
  it('points Playwright at the bundled browsers when packaged and they exist', () => {
    const exists = (p: string) => p.replace(/\\/g, '/') === 'C:/App/resources/browsers';
    expect(resolveBrowsersPath({ isPackaged: true, resourcesPath: 'C:\\App\\resources', exists }))
      .toBe('C:\\App\\resources\\browsers');
  });
  it('returns null in development or when the bundle is missing, so the default cache is used', () => {
    expect(resolveBrowsersPath({ isPackaged: false, resourcesPath: 'C:\\App\\resources', exists: () => true })).toBeNull();
    expect(resolveBrowsersPath({ isPackaged: true, resourcesPath: 'C:\\App\\resources', exists: () => false })).toBeNull();
  });
});

describe('contentSecurityPolicy', () => {
  it('is a strict policy for the gpflow:// origin', () => {
    const csp = contentSecurityPolicy();
    const directive = (name: string) => {
      const d = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' ') || s === name);
      if (!d) throw new Error(`directive ${name} missing from: ${csp}`);
      return d.slice(name.length).trim().split(/\s+/);
    };
    expect(directive('default-src')).toEqual(["'self'", 'gpflow:']);
    expect(directive('script-src')).toEqual(["'self'", 'gpflow:']);
    expect(directive('style-src')).toEqual(["'self'", 'gpflow:', "'unsafe-inline'"]);
    expect(directive('font-src')).toEqual(["'self'", 'gpflow:']);
    expect(directive('img-src')).toEqual(["'self'", 'gpflow:', 'data:']);
    expect(directive('connect-src')).toEqual(["'self'", 'gpflow:']);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'none'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-eval/);
    expect(csp).not.toMatch(/https?:/);
  });

  it('allows only the given inline scripts, by hash, never unsafe-inline for scripts', () => {
    const csp = contentSecurityPolicy({ scriptHashes: ['sha256-abc', 'sha256-def'] });
    const script = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src '))!;
    expect(script).toBe("script-src 'self' gpflow: 'sha256-abc' 'sha256-def'");
    expect(script).not.toMatch(/unsafe-inline/);
  });
});

describe('inlineScriptHashes', () => {
  it('hashes the exact body of each inline <script> (Next static export bootstrap) and skips external ones', () => {
    const html = [
      '<html><head><script src="/_next/static/chunks/a.js" async=""></script>',
      '<script>(self.__next_f=self.__next_f||[]).push([0])</script>',
      '<script>self.__next_f.push([1,"x"])</script></head></html>',
    ].join('');
    const hashes = inlineScriptHashes(html);
    const sha = (s: string) => 'sha256-' + createHash('sha256').update(s, 'utf8').digest('base64');
    expect(hashes).toEqual([sha('(self.__next_f=self.__next_f||[]).push([0])'), sha('self.__next_f.push([1,"x"])')]);
  });
  it('returns nothing for HTML without inline scripts', () => {
    expect(inlineScriptHashes('<html><script src="/a.js"></script><p>hi</p></html>')).toEqual([]);
  });
});
