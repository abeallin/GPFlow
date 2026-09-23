import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Browser } from 'playwright-core';
import { loginToAccurx, DEFAULT_NHS_MFA_TIMEOUT_MS } from '../../../automation/actions/login';
import { launchBrowser } from './fixtures';
import { installNhsSimulation } from './nhs-fixtures';

describe('NHSmail SSO login', () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 60000);
  afterAll(async () => { await browser?.close(); });

  it('gives the user at least five minutes to approve Microsoft MFA by default', () => {
    expect(DEFAULT_NHS_MFA_TIMEOUT_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it('a wrong password is reported once, without re-submitting it', async () => {
    const page = await browser.newPage();
    const sim = await installNhsSimulation(page, { correctPassword: 'right', mfaDelayMs: 100 });

    const result = await loginToAccurx(page, 'user@nhs.net', 'wrong', { nhsMfaTimeoutMs: 3000 });

    expect(result.success).toBe(false);
    expect(result.requires2fa).toBe(false);
    expect(result.error).toMatch(/password/i);
    expect(sim.submits()).toBe(1);
    await page.close();
  }, 60000);

  it('honours the MFA timeout option (proves the long default is the one that matters)', async () => {
    const page = await browser.newPage();
    await installNhsSimulation(page, { correctPassword: 'right', mfaDelayMs: 2500 });

    const result = await loginToAccurx(page, 'user@nhs.net', 'right', { nhsMfaTimeoutMs: 800 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/MFA|approve|timed out/i);
    await page.close();
  }, 60000);

  it('succeeds once MFA is approved, passing through the "Stay signed in?" prompt', async () => {
    const page = await browser.newPage();
    const sim = await installNhsSimulation(page, { correctPassword: 'right', mfaDelayMs: 1000, showKmsi: true });

    const result = await loginToAccurx(page, 'user@nhs.net', 'right', { nhsMfaTimeoutMs: 10000 });

    expect(result).toEqual({ success: true, requires2fa: false });
    expect(page.url()).toContain('web.accurx.com/inbox');
    expect(sim.submits()).toBe(1);
    await page.close();
  }, 60000);
});
