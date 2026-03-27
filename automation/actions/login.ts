import type { Page } from 'playwright-core';

const LOGIN_URL = 'https://web.accurx.com/login?product=2';
const LOGIN_FORM_URL = 'https://web.accurx.com/login?product=2&showLoginForm=true';
const INBOX_URL = 'https://web.accurx.com/inbox/w';
const TWO_FACTOR_URL = 'https://web.accurx.com/two-factor-auth';

export interface LoginResult {
  success: boolean;
  requires2fa: boolean;
  error?: string;
}

function isNhsEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith('@nhs.net') || lower.endsWith('@nhs.uk');
}

export async function loginToAccurx(
  page: Page,
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    if (isNhsEmail(username)) {
      return await loginViaNhsMail(page, username, password);
    } else {
      return await loginViaForm(page, username, password);
    }
  } catch (error) {
    return {
      success: false,
      requires2fa: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Direct email/password form — for non-NHS.net accounts */
async function loginViaForm(
  page: Page,
  username: string,
  password: string,
): Promise<LoginResult> {
  await page.goto(LOGIN_FORM_URL, { waitUntil: 'domcontentloaded' });

  if (page.url().includes(INBOX_URL)) {
    return { success: true, requires2fa: false };
  }

  const emailInput = page.getByLabel('Email').or(page.locator('#user-email'));
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(username);

  const passwordInput = page.getByLabel('Password').or(page.locator('#user-password'));
  await passwordInput.fill(password);

  const submitButton = page.getByRole('button', { name: 'Log in', exact: true })
    .or(page.locator('button[type="submit"]'));
  await submitButton.click();

  return await waitForLoginResult(page);
}

/** NHSmail SSO flow — for @nhs.net / @nhs.uk accounts */
async function loginViaNhsMail(
  page: Page,
  username: string,
  password: string,
): Promise<LoginResult> {
  // Go to main login page (without showLoginForm)
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  if (page.url().includes(INBOX_URL)) {
    return { success: true, requires2fa: false };
  }

  // Click "Continue with NHSmail" button
  const nhsMailButton = page.getByRole('button', { name: /NHSmail/i })
    .or(page.getByText(/Continue with NHSmail/i))
    .or(page.locator('button:has-text("NHSmail")'));
  await nhsMailButton.waitFor({ state: 'visible', timeout: 10000 });
  await nhsMailButton.click();

  // Microsoft SSO page — enter email
  const msEmailInput = page.getByPlaceholder(/email/i)
    .or(page.locator('input[type="email"]'))
    .or(page.locator('#i0116'));
  await msEmailInput.waitFor({ state: 'visible', timeout: 15000 });
  await msEmailInput.fill(username);

  // Click Next
  const nextButton = page.getByRole('button', { name: /Next/i })
    .or(page.locator('#idSIButton9'));
  await nextButton.click();

  // Enter password on Microsoft page
  const msPasswordInput = page.getByPlaceholder(/password/i)
    .or(page.locator('input[type="password"]'))
    .or(page.locator('#i0118'));
  await msPasswordInput.waitFor({ state: 'visible', timeout: 15000 });
  await msPasswordInput.fill(password);

  // Click Sign in
  const signInButton = page.getByRole('button', { name: /Sign in/i })
    .or(page.locator('#idSIButton9'));
  await signInButton.click();

  // Microsoft may ask "Stay signed in?" — click Yes or No
  try {
    const staySignedIn = page.getByRole('button', { name: /Yes/i })
      .or(page.locator('#idSIButton9'));
    await staySignedIn.waitFor({ state: 'visible', timeout: 5000 });
    await staySignedIn.click();
  } catch {
    // No "Stay signed in" prompt — continue
  }

  return await waitForLoginResult(page);
}

/** Wait for Accurx to finish login — inbox or 2FA */
async function waitForLoginResult(page: Page): Promise<LoginResult> {
  await page.waitForURL((url) => {
    const href = url.toString();
    return href.includes(INBOX_URL) || href.includes(TWO_FACTOR_URL);
  }, { timeout: 30000 });

  if (page.url().includes(TWO_FACTOR_URL)) {
    return { success: false, requires2fa: true };
  }

  try {
    await page.waitForSelector('[data-userflow-id="navigation-inbox-link"]', { timeout: 10000 });
  } catch {
    // Inbox loaded but specific element not found — still success if URL matches
  }

  return { success: true, requires2fa: false };
}

export async function waitFor2faCompletion(page: Page, timeoutMs = 300000): Promise<boolean> {
  try {
    await page.waitForURL((url) => url.toString().includes(INBOX_URL), {
      timeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}
