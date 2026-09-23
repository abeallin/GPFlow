import type { Page } from 'playwright-core';

const LOGIN_URL = 'https://web.accurx.com/login?product=2';
const LOGIN_FORM_URL = 'https://web.accurx.com/login?product=2&showLoginForm=true';
const INBOX_URL = 'https://web.accurx.com/inbox/w';
const TWO_FACTOR_URL = 'https://web.accurx.com/two-factor-auth';

/** NHSmail MFA happens on the Microsoft page (Authenticator approve / SMS code): give the user five minutes. */
export const DEFAULT_NHS_MFA_TIMEOUT_MS = 5 * 60 * 1000;
/** Direct email/password login: Accurx either lands on the inbox or its own 2FA page quickly. */
export const DEFAULT_FORM_LOGIN_TIMEOUT_MS = 30 * 1000;

export interface LoginResult {
  success: boolean;
  requires2fa: boolean;
  error?: string;
}

export interface LoginOptions {
  nhsMfaTimeoutMs?: number;
  formLoginTimeoutMs?: number;
}

function isNhsEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith('@nhs.net') || lower.endsWith('@nhs.uk');
}

export async function loginToAccurx(
  page: Page,
  username: string,
  password: string,
  opts: LoginOptions = {},
): Promise<LoginResult> {
  try {
    if (isNhsEmail(username)) {
      return await loginViaNhsMail(page, username, password, opts.nhsMfaTimeoutMs ?? DEFAULT_NHS_MFA_TIMEOUT_MS);
    }
    return await loginViaForm(page, username, password, opts.formLoginTimeoutMs ?? DEFAULT_FORM_LOGIN_TIMEOUT_MS);
  } catch (error) {
    return {
      success: false,
      requires2fa: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Direct email/password form — for non-NHS.net accounts */
async function loginViaForm(page: Page, username: string, password: string, timeoutMs: number): Promise<LoginResult> {
  await page.goto(LOGIN_FORM_URL, { waitUntil: 'domcontentloaded' });

  if (page.url().includes(INBOX_URL)) {
    return { success: true, requires2fa: false };
  }

  const emailInput = page.getByLabel('Email').or(page.locator('#user-email'));
  await emailInput.first().waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.first().fill(username);

  const passwordInput = page.getByLabel('Password').or(page.locator('#user-password'));
  await passwordInput.first().fill(password);

  const submitButton = page.getByRole('button', { name: 'Log in', exact: true })
    .or(page.locator('button[type="submit"]'));
  await submitButton.first().click();

  return await waitForLoginResult(page, timeoutMs, 'Accurx did not reach the inbox or 2FA page');
}

/** NHSmail SSO flow — for @nhs.net / @nhs.uk accounts */
async function loginViaNhsMail(page: Page, username: string, password: string, mfaTimeoutMs: number): Promise<LoginResult> {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  if (page.url().includes(INBOX_URL)) {
    return { success: true, requires2fa: false };
  }

  const nhsMailButton = page.getByRole('button', { name: /NHSmail/i })
    .or(page.getByRole('link', { name: /NHSmail/i }));
  await nhsMailButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await nhsMailButton.first().click();

  // Microsoft: email
  const msEmailInput = page.locator('#i0116').or(page.locator('input[type="email"]'));
  await msEmailInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await msEmailInput.first().fill(username);
  await page.locator('#idSIButton9').or(page.getByRole('button', { name: /^next$/i })).first().click();

  // Microsoft: password
  const msPasswordInput = page.locator('#i0118').or(page.locator('input[type="password"]'));
  await msPasswordInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await msPasswordInput.first().fill(password);

  const passwordPageUrl = page.url();
  await page.locator('#idSIButton9').or(page.getByRole('button', { name: /sign in/i })).first().click();

  // Microsoft reuses #idSIButton9 on every page, so never click it "again" blindly.
  // Either the password page shows an error, or we leave it (KMSI prompt, MFA, or straight to Accurx).
  const outcome = await Promise.race([
    page.locator('#passwordError').filter({ visible: true }).first()
      .waitFor({ state: 'visible', timeout: 20000 }).then(() => 'error' as const),
    page.waitForURL((u) => u.toString() !== passwordPageUrl, { timeout: 20000 }).then(() => 'moved' as const),
  ]).catch(() => 'stuck' as const);

  if (outcome === 'error') {
    const text = (await page.locator('#passwordError').first().innerText().catch(() => '')).trim();
    return { success: false, requires2fa: false, error: text || 'Microsoft rejected the password' };
  }
  if (outcome === 'stuck') {
    return { success: false, requires2fa: false, error: 'Microsoft sign-in did not proceed after submitting the password' };
  }

  // Everything after the password submit (KMSI prompt, MFA approval) shares one budget.
  const deadline = Date.now() + mfaTimeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());

  // "Stay signed in?" — only answer it if it is actually shown.
  const kmsi = page.locator('#KmsiCheckboxField').or(page.getByText(/stay signed in\?/i));
  const kmsiShown = await kmsi.first()
    .waitFor({ state: 'visible', timeout: Math.min(3000, remaining()) })
    .then(() => true)
    .catch(() => false);
  if (kmsiShown) {
    await page.locator('#idSIButton9').or(page.getByRole('button', { name: /^yes$/i })).first().click();
  }

  return await waitForLoginResult(page, remaining(), 'Timed out waiting for NHSmail MFA approval');
}

/** Wait for Accurx to finish login — inbox or its own 2FA page. */
async function waitForLoginResult(page: Page, timeoutMs: number, timeoutMessage: string): Promise<LoginResult> {
  try {
    await page.waitForURL((url) => {
      const href = url.toString();
      return href.includes(INBOX_URL) || href.includes(TWO_FACTOR_URL);
    }, { timeout: timeoutMs });
  } catch {
    return { success: false, requires2fa: false, error: `${timeoutMessage} (${Math.round(timeoutMs / 1000)}s)` };
  }

  if (page.url().includes(TWO_FACTOR_URL)) {
    return { success: false, requires2fa: true };
  }

  try {
    await page.waitForSelector('[data-userflow-id="navigation-inbox-link"]', { timeout: 10000 });
  } catch {
    // Inbox URL reached; the nav element is just a nicety
  }

  return { success: true, requires2fa: false };
}

export async function waitFor2faCompletion(page: Page, timeoutMs = 300000): Promise<boolean> {
  try {
    await page.waitForURL((url) => url.toString().includes(INBOX_URL), { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}
