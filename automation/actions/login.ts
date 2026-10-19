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
  directOnly?: boolean;
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
    if (page.url().includes(INBOX_URL) || page.url().includes('accurx.com/inbox') || page.url().includes('accurx.com/w/')) {
      return { success: true, requires2fa: false };
    }
    if (opts.directOnly) {
      return await loginViaForm(page, username, password, opts.formLoginTimeoutMs ?? DEFAULT_FORM_LOGIN_TIMEOUT_MS);
    }
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

/** Direct email/password form — for non-NHS.net accounts or direct Accurx logins */
async function loginViaForm(page: Page, username: string, password: string, timeoutMs: number): Promise<LoginResult> {
  await page.goto(LOGIN_FORM_URL, { waitUntil: 'domcontentloaded' });

  if (page.url().includes(INBOX_URL) || page.url().includes('accurx.com/inbox') || page.url().includes('accurx.com/w/')) {
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

  const outcome = await Promise.race([
    page.waitForURL((u) => {
      const href = u.toString();
      return href.includes(INBOX_URL) || href.includes(TWO_FACTOR_URL) || href.includes('accurx.com/inbox') || href.includes('accurx.com/w/');
    }, { timeout: timeoutMs }).then(() => 'success' as const),
    page.locator('[role="alert"]').filter({ hasText: /\S/ }).first()
      .waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 6000) })
      .then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (outcome === 'error') {
    const text = (await page.locator('[role="alert"]').first().innerText().catch(() => '')).trim();
    return { success: false, requires2fa: false, error: text || 'Invalid email or password' };
  }
  if (outcome === 'timeout') {
    return { success: false, requires2fa: false, error: `Accurx direct login did not reach inbox or 2FA within ${Math.round(timeoutMs / 1000)}s` };
  }

  if (page.url().includes(TWO_FACTOR_URL)) {
    return { success: false, requires2fa: true };
  }
  return { success: true, requires2fa: false };
}

/** NHSmail SSO flow — for @nhs.net / @nhs.uk accounts */
async function loginViaNhsMail(page: Page, username: string, password: string, mfaTimeoutMs: number): Promise<LoginResult> {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  if (page.url().includes(INBOX_URL) || page.url().includes('accurx.com/inbox') || page.url().includes('accurx.com/w/')) {
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

  // After "Next", Microsoft either asks for the password itself or federates the account
  // to the NHS server (fs.nhs.net, ADFS). Wait for whichever form appears.
  const landed = await waitForAny(page, {
    microsoft: '#i0118',
    adfsLogin: '#passwordInput, input[type="password"]',
    adfsSelection: '[aria-label="Active Directory"], .idp:has-text("Active Directory"), .idp',
    adfsHrd: '#emailInput',
  }, 25000);

  let failure: string | null = null;
  if (landed === 'microsoft') {
    failure = await submitMicrosoftPassword(page, password);
  } else if (
    landed === 'adfsLogin' ||
    landed === 'adfsSelection' ||
    landed === 'adfsHrd' ||
    page.url().includes('fs.nhs.net')
  ) {
    failure = await submitAdfsLogin(page, username, password, landed === 'adfsHrd');
  } else {
    return { success: false, requires2fa: false, error: 'Neither the Microsoft nor the NHS sign-in form appeared after entering the email' };
  }
  if (failure) return { success: false, requires2fa: false, error: failure };

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

/** Resolve with the key of the first selector to become visible, or null on timeout. */
async function waitForAny<K extends string>(page: Page, selectors: Record<K, string>, timeoutMs: number): Promise<K | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.url().includes('fs.nhs.net')) {
      for (const k of ['adfsLogin', 'adfsSelection', 'adfsHrd'] as K[]) {
        if (k in selectors && (await page.locator(selectors[k]).first().isVisible().catch(() => false))) {
          return k;
        }
      }
    }
    for (const key of Object.keys(selectors) as K[]) {
      if (await page.locator(selectors[key]).first().isVisible().catch(() => false)) return key;
    }
    await page.waitForTimeout(100);
  }
  if (page.url().includes('fs.nhs.net')) {
    for (const k of ['adfsLogin', 'adfsSelection', 'adfsHrd'] as K[]) {
      if (k in selectors) return k;
    }
  }
  return null;
}

/** Microsoft's own password page. Returns an error message, or null when we moved on. */
async function submitMicrosoftPassword(page: Page, password: string): Promise<string | null> {
  await page.locator('#i0118').first().fill(password);

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
    return text || 'Microsoft rejected the password';
  }
  if (outcome === 'stuck') return 'Microsoft sign-in did not proceed after submitting the password';
  return null;
}

/**
 * The NHS federation server (fs.nhs.net/adfs/ls):
 * May present:
 *  1. An account selection (HRD) screen: "Active Directory" vs "NHS CIS2 - Smartcard"
 *  2. An organizational realm discovery email input (#emailInput + Next)
 *  3. The username/password login form (#userNameInput, #passwordInput, #submitButton)
 * Errors render into <span id="errorText" role="alert">. Returns an error message, or null when we moved on.
 */
async function submitAdfsLogin(page: Page, username: string, password: string, atHrd?: boolean): Promise<string | null> {
  const passwordInput = page.locator('#passwordInput, input[type="password"]');
  const hasPasswordAlready = await passwordInput.first().isVisible().catch(() => false);

  if (atHrd || !hasPasswordAlready) {
    const adButton = page
      .locator('[aria-label="Active Directory"], .idp:has-text("Active Directory")')
      .or(page.getByText('Active Directory', { exact: false }));
    const emailInput = page.locator('#emailInput');

    if (await adButton.first().isVisible().catch(() => false)) {
      await adButton.first().click();
      await passwordInput.first().waitFor({ state: 'visible', timeout: 20000 });
    } else if (await emailInput.first().isVisible().catch(() => false)) {
      await emailInput.first().fill(username);
      await page.locator('input[name="HomeRealmByEmail"]').or(page.getByRole('button', { name: /^next$/i })).first().click();
      await passwordInput.first().waitFor({ state: 'visible', timeout: 20000 });
    } else {
      const choice = await waitForAny(page, {
        login: '#passwordInput, input[type="password"]',
        activeDirectory: '[aria-label="Active Directory"], .idp:has-text("Active Directory")',
        email: '#emailInput',
      }, 15000);

      if (choice === 'activeDirectory') {
        await adButton.first().click();
        await passwordInput.first().waitFor({ state: 'visible', timeout: 20000 });
      } else if (choice === 'email') {
        await emailInput.first().fill(username);
        await page.locator('input[name="HomeRealmByEmail"]').or(page.getByRole('button', { name: /^next$/i })).first().click();
        await passwordInput.first().waitFor({ state: 'visible', timeout: 20000 });
      }
    }
  }

  await passwordInput.first().waitFor({ state: 'visible', timeout: 20000 });

  const userField = page.locator('#userNameInput, input[name="UserName"]');
  if ((await userField.count()) > 0 && !(await userField.first().inputValue().catch(() => ''))) {
    await userField.first().fill(username);
  }
  await passwordInput.first().fill(password);

  const submitBtn = page
    .locator('#submitButton')
    .or(page.getByRole('button', { name: /sign in/i }))
    .or(page.locator('button[type="submit"], input[type="submit"]'));
  await submitBtn.first().click();

  const errorText = page.locator('#errorText').filter({ hasText: /\S/ });
  const outcome = await Promise.race([
    errorText.first().waitFor({ state: 'visible', timeout: 20000 }).then(() => 'error' as const),
    page.waitForURL((u) => !u.toString().includes('fs.nhs.net'), { timeout: 20000 }).then(() => 'moved' as const),
  ]).catch(() => 'stuck' as const);

  if (outcome === 'error') {
    const text = (await errorText.first().innerText().catch(() => '')).trim();
    return text || 'The NHS sign-in server rejected the password';
  }
  if (outcome === 'stuck') return 'NHS sign-in did not proceed after submitting the password';
  return null;
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
