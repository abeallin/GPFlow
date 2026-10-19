import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const PROFILE_DIR = path.join(process.cwd(), 'gpflow-browser-profile');
const STORAGE_STATE_PATH = path.join(process.cwd(), 'gpflow-storage-state.json');

async function main() {
  console.log('=== Accurx Interactive Session Setup ===');
  console.log(`Using profile directory: ${PROFILE_DIR}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || (await context.newPage());

  console.log('Navigating to Accurx login / QR code...');
  await page.goto('https://web.accurx.com/qr?product=2', { waitUntil: 'domcontentloaded' });

  console.log('\n-------------------------------------------------------------');
  console.log('A browser window has opened.');
  console.log('You have two easy ways to log in without needing a password:');
  console.log('  1. SCAN QR CODE: Open Accurx on your phone -> Settings -> Log in on web -> scan QR.');
  console.log('  2. OR ANY OTHER METHOD: Click back / options to use Smartcard, CIS2, or SSO.');
  console.log('-------------------------------------------------------------');
  console.log('Waiting for successful login to Accurx inbox...');

  // Wait until user reaches the inbox or settings
  const deadline = Date.now() + 10 * 60 * 1000; // 10 minutes
  let loggedIn = false;

  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('accurx.com/inbox') || url.includes('accurx.com/w/') || url.includes('/settings')) {
      loggedIn = true;
      break;
    }
    await page.waitForTimeout(1000);
  }

  if (loggedIn) {
    console.log('\n>>> LOGIN SUCCESSFUL! <<<');
    console.log(`Current URL: ${page.url()}`);
    
    // Save storage state for reuse
    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`Session saved successfully to ${STORAGE_STATE_PATH}!`);
    console.log('Future automation runs can now use this session without asking for passwords.');
  } else {
    console.log('\nTimed out waiting for login (10 minutes elapsed).');
  }

  await context.close();
  console.log('Browser closed.');
}

main().catch(console.error);
