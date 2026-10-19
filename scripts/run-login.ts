import { chromium } from 'playwright-core';
import { loginToAccurx } from '../automation/actions/login.ts';

const username = process.argv[2] || '93capp.ncltexttemplates@nhs.net';
const password = process.argv[3];

if (!password) {
  console.error('\nUsage: node --experimental-strip-types scripts/run-login.ts <username> <password>');
  console.error('Example: node --experimental-strip-types scripts/run-login.ts 93capp.ncltexttemplates@nhs.net "YourSecretPassword"\n');
  process.exit(1);
}

async function run() {
  console.log(`\n===========================================`);
  console.log(`Launching Playwright for: ${username}`);
  console.log(`===========================================\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Initiating loginToAccurx...');
  const result = await loginToAccurx(page, username, password, {
    nhsMfaTimeoutMs: 5 * 60 * 1000,
  });

  console.log('\nLogin result:', result);

  if (result.success) {
    console.log('\n>>> SUCCESS: Logged in and reached Accurx inbox! <<<');
  } else if (result.requires2fa) {
    console.log('\n>>> 2FA required. Please complete in the browser window <<<');
  } else {
    console.error('\n>>> Login failed:', result.error);
  }

  console.log('\nBrowser will remain open for 2 minutes for verification...');
  await page.waitForTimeout(120000);
  await browser.close();
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
