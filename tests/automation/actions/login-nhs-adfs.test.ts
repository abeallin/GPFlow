import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Browser } from 'playwright-core';
import { loginToAccurx } from '../../../automation/actions/login';
import { launchBrowser } from './fixtures';
import { installNhsSimulation } from './nhs-fixtures';

/**
 * nhs.net accounts are federated: Microsoft sends them to fs.nhs.net (ADFS), which has
 * its own two-step form. Observed live on 2026-09-23 (run #7 timed out because the
 * Microsoft-only flow never filled the ADFS password).
 */
describe('NHSmail SSO via the NHS federation server (ADFS)', () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 60000);
  afterAll(async () => { await browser?.close(); });

  it('fills the realm-discovery email, then username and password, and reaches the inbox', async () => {
    const page = await browser.newPage();
    const sim = await installNhsSimulation(page, { correctPassword: 'right', mfaDelayMs: 800, federation: 'adfs', showKmsi: true });

    const result = await loginToAccurx(page, 'user@nhs.net', 'right', { nhsMfaTimeoutMs: 15000 });

    expect(result).toEqual({ success: true, requires2fa: false });
    expect(page.url()).toContain('web.accurx.com/inbox');
    expect(sim.hrdEmails()).toEqual(['user@nhs.net']);
    expect(sim.submits()).toBe(1);
    await page.close();
  }, 60000);

  it('handles landing straight on the login form with the username pre-filled', async () => {
    const page = await browser.newPage();
    const sim = await installNhsSimulation(page, { correctPassword: 'right', mfaDelayMs: 500, federation: 'adfs', adfsSkipsHrd: true });

    const result = await loginToAccurx(page, 'user@nhs.net', 'right', { nhsMfaTimeoutMs: 15000 });

    expect(result).toEqual({ success: true, requires2fa: false });
    expect(sim.submits()).toBe(1);
    await page.close();
  }, 60000);

  it('reports a wrong password from the ADFS error text, once, without re-submitting', async () => {
    const page = await browser.newPage();
    const sim = await installNhsSimulation(page, { correctPassword: 'right', mfaDelayMs: 500, federation: 'adfs' });

    const result = await loginToAccurx(page, 'user@nhs.net', 'wrong', { nhsMfaTimeoutMs: 5000 });

    expect(result.success).toBe(false);
    expect(result.requires2fa).toBe(false);
    expect(result.error).toMatch(/incorrect user id or password/i);
    expect(sim.submits()).toBe(1);
    await page.close();
  }, 60000);
});
