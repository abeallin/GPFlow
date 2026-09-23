import { describe, it, expect } from 'vitest';
import { isAllowedNavigation, isTrustedSender, resolveBrowsersPath } from '../../electron/security';

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
