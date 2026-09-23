/**
 * Manual test script — launches Playwright, logs into Accurx, waits for 2FA.
 * Run with: node scripts/test-login.mjs
 */
import { chromium } from 'playwright-core';
import { config } from 'dotenv';

config(); // Load .env

const LOGIN_URL = 'https://web.accurx.com/login?product=2&showLoginForm=true';
const INBOX_URL = 'https://web.accurx.com/inbox/w';
const TWO_FACTOR_URL = 'https://web.accurx.com/two-factor-auth';

const username = process.env.ACCURX_USERNAME;
const password = process.env.ACCURX_PASSWORD;

if (!username || !password) {
  console.error('Missing ACCURX_USERNAME or ACCURX_PASSWORD in .env');
  process.exit(1);
}

console.log(`\nLogging in as: ${username}`);
console.log('Launching browser...\n');

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

try {
  // Navigate to login
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
  console.log('Loaded login page:', page.url());

  // Check if already logged in
  if (page.url().includes(INBOX_URL)) {
    console.log('Already logged in!');
  } else {
    // Fill login form
    console.log('Filling credentials...');

    const emailInput = page.getByLabel('Email').or(page.locator('#user-email'));
    await emailInput.fill(username);
    console.log('  Email filled');

    const passwordInput = page.getByLabel('Password').or(page.locator('#user-password'));
    await passwordInput.fill(password);
    console.log('  Password filled');

    const submitButton = page.getByRole('button', { name: 'Log in', exact: true })
      .or(page.locator('button[type="submit"]'));
    await submitButton.click();
    console.log('  Submit clicked, waiting for redirect...');

    // Wait for navigation
    await page.waitForURL((url) => {
      const href = url.toString();
      return href.includes(INBOX_URL) || href.includes(TWO_FACTOR_URL);
    }, { timeout: 15000 });

    console.log('Redirected to:', page.url());

    // Check for 2FA
    if (page.url().includes(TWO_FACTOR_URL)) {
      console.log('\n2FA REQUIRED — complete it in the browser window.');
      console.log('Waiting up to 5 minutes...\n');

      try {
        await page.waitForURL((url) => url.toString().includes(INBOX_URL), {
          timeout: 300000, // 5 minutes
        });
        console.log('2FA completed! Redirected to inbox.');
      } catch {
        console.error('2FA timeout — did not complete within 5 minutes.');
        await browser.close();
        process.exit(1);
      }
    }

    // Verify inbox loaded
    await page.waitForSelector('[data-userflow-id="navigation-inbox-link"]', { timeout: 10000 });
    console.log('Login successful! Inbox loaded.\n');
  }

  // Now test navigating to a template page
  console.log('Testing navigation to a template page...');
  const testUrl = 'https://web.accurx.com/w/571/settings/templates?tab=OrganisationTemplates';
  await page.goto(testUrl, { waitUntil: 'networkidle' });
  console.log('Template page loaded:', page.url());

  // Check what's on the page
  const pageTitle = await page.title();
  console.log('Page title:', pageTitle);

  // Look for the create template button
  const createBtn = page.getByRole('link', { name: /create template/i })
    .or(page.locator('a[href*="templates/create"]'));
  const createBtnCount = await createBtn.count();
  console.log('Create template button found:', createBtnCount > 0);

  // Take a screenshot for reference
  await page.screenshot({ path: 'screenshots/test-login-result.png', fullPage: true });
  console.log('Screenshot saved to screenshots/test-login-result.png');

  console.log('\nTest complete. Browser will stay open for 30 seconds for inspection.');
  await page.waitForTimeout(30000);

} catch (error) {
  console.error('Error:', error.message);
  await page.screenshot({ path: 'screenshots/test-login-error.png' }).catch(() => {});
} finally {
  await browser.close();
  console.log('Browser closed.');
}
