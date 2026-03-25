import type { Page } from 'playwright-core';

const LOGIN_URL = 'https://web.accurx.com/login?product=2&showLoginForm=true';
const INBOX_URL = 'https://web.accurx.com/inbox/w';
const TWO_FACTOR_URL = 'https://web.accurx.com/two-factor-auth';

export interface LoginResult {
  success: boolean;
  requires2fa: boolean;
  error?: string;
}

export async function loginToAccurx(
  page: Page,
  username: string,
  password: string,
): Promise<LoginResult> {
  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    if (page.url().includes(INBOX_URL)) {
      return { success: true, requires2fa: false };
    }

    const emailInput = page.getByLabel('Email').or(page.locator('#user-email'));
    await emailInput.fill(username);

    const passwordInput = page.getByLabel('Password').or(page.locator('#user-password'));
    await passwordInput.fill(password);

    const submitButton = page.getByRole('button', { name: /log in|sign in/i })
      .or(page.locator('button[type="submit"]'));
    await submitButton.click();

    await page.waitForURL((url) => {
      const href = url.toString();
      return href.includes(INBOX_URL) || href.includes(TWO_FACTOR_URL);
    }, { timeout: 15000 });

    if (page.url().includes(TWO_FACTOR_URL)) {
      return { success: false, requires2fa: true };
    }

    await page.waitForSelector('[data-userflow-id="navigation-inbox-link"]', { timeout: 10000 });

    return { success: true, requires2fa: false };
  } catch (error) {
    return {
      success: false,
      requires2fa: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
