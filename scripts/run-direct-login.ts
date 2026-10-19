import { chromium } from 'playwright-core';
import path from 'path';

const LOGIN_FORM_URL = 'https://web.accurx.com/login?product=2&showLoginForm=true';
const STORAGE_STATE_PATH = path.join(process.cwd(), 'gpflow-storage-state.json');

const username = process.argv[2] || '93capp.ncltexttemplates@nhs.net';
const password = process.argv[3];

if (!password) {
  console.error('\nUsage: node --experimental-strip-types scripts/run-direct-login.ts <username> <password>');
  console.error('Example: node --experimental-strip-types scripts/run-direct-login.ts 93capp.ncltexttemplates@nhs.net "YourAccurxPassword"\n');
  process.exit(1);
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`Direct Accurx Login (Bypassing fs.nhs.net / Microsoft)`);
  console.log(`Target Email: ${username}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Step 1: Navigating directly to Accurx form: ${LOGIN_FORM_URL}`);
  await page.goto(LOGIN_FORM_URL, { waitUntil: 'domcontentloaded' });

  // Wait for inputs to render
  console.log('Step 2: Waiting for email and password inputs...');
  const emailInput = page.locator('#user-email').or(page.getByLabel('Email'));
  const pwInput = page.locator('#user-password').or(page.getByLabel('Password'));

  await emailInput.first().waitFor({ state: 'visible', timeout: 15000 });
  await pwInput.first().waitFor({ state: 'visible', timeout: 15000 });

  console.log(`Step 3: Filling email: ${username}`);
  await emailInput.first().fill(username);

  console.log('Step 4: Filling password...');
  await pwInput.first().fill(password);

  console.log('Step 5: Clicking "Log in" button...');
  const submitButton = page.getByRole('button', { name: 'Log in', exact: true }).or(page.locator('button[type="submit"]'));
  await submitButton.first().click();

  console.log('Step 6: Waiting for login outcome (Inbox, 2FA, or error)...');
  const outcome = await Promise.race([
    page.waitForURL((u) => u.toString().includes('inbox') || u.toString().includes('/w/'), { timeout: 20000 }).then(() => 'inbox' as const),
    page.waitForURL((u) => u.toString().includes('two-factor-auth'), { timeout: 20000 }).then(() => '2fa' as const),
    page.locator('[role="alert"]').filter({ hasText: /\S/ }).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (outcome === 'inbox') {
    console.log('\n>>> SUCCESS! Logged into Accurx inbox without visiting fs.nhs.net! <<<');
    console.log(`Current URL: ${page.url()}`);
    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`Saved session to ${STORAGE_STATE_PATH} for future bulk runs!`);
  } else if (outcome === '2fa') {
    console.log('\n>>> 2FA REQUIRED! Accurx sent a code. Please complete it in the open browser window <<<');
    // Wait for user to finish 2FA
    try {
      await page.waitForURL((u) => u.toString().includes('inbox') || u.toString().includes('/w/'), { timeout: 300000 });
      console.log('\n>>> 2FA COMPLETED! Reached Accurx inbox! <<<');
      await context.storageState({ path: STORAGE_STATE_PATH });
      console.log(`Saved session to ${STORAGE_STATE_PATH}!`);
    } catch {
      console.log('Timed out waiting for 2FA completion.');
    }
  } else if (outcome === 'error') {
    const errorText = (await page.locator('[role="alert"]').first().innerText().catch(() => '')).trim();
    console.error(`\n>>> Accurx rejected the login: "${errorText}"`);
  } else {
    console.log(`\nOutcome: ${outcome}. Current URL: ${page.url()}`);
  }

  console.log('\nBrowser will remain open for 60 seconds for inspection...');
  await page.waitForTimeout(60000);
  await browser.close();
  console.log('Browser closed.');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
