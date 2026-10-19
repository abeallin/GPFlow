import { chromium } from 'playwright-core';

async function main() {
  console.log('=== Launching Playwright Chromium ===');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down operations by 500ms so we can watch live
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Step 1: Reading stored accounts/passwords from http://localhost:3000...');
  try {
    await page.goto('http://localhost:3000/accounts', { waitUntil: 'domcontentloaded', timeout: 10000 });
    const storedAccounts = await page.evaluate(() => {
      return {
        accounts: localStorage.getItem('gpflow_accounts'),
        localPasswords: localStorage.getItem('gpflow_passwords'),
        sessionPasswords: sessionStorage.getItem('gpflow_passwords'),
      };
    });
    console.log('Stored data:', storedAccounts);

    let password = '';
    let username = '93capp.ncltexttemplates@nhs.net';

    try {
      const passwords = JSON.parse(storedAccounts.sessionPasswords || storedAccounts.localPasswords || '{}');
      const accounts = JSON.parse(storedAccounts.accounts || '[]');
      const acc = accounts.find((a) => a.username?.toLowerCase() === username.toLowerCase());
      if (acc && passwords[acc.id]) {
        password = passwords[acc.id];
        console.log(`Found password for ${username} (length: ${password.length})`);
      } else {
        const firstPw = Object.values(passwords)[0];
        if (firstPw) {
          password = firstPw;
          console.log(`Using available stored password (length: ${password.length})`);
        }
      }
    } catch (e) {
      console.log('Could not parse stored accounts:', e.message);
    }

    console.log('\nStep 2: Navigating to Accurx Login...');
    await page.goto('https://web.accurx.com/login?product=2', { waitUntil: 'domcontentloaded' });
    console.log('Current URL:', page.url());

    // Check if already in inbox
    if (page.url().includes('inbox')) {
      console.log('Already logged in to Accurx inbox!');
      return;
    }

    // Click NHSmail button
    console.log('Step 3: Looking for NHSmail button...');
    const nhsButton = page.getByRole('button', { name: /NHSmail/i }).or(page.getByRole('link', { name: /NHSmail/i }));
    await nhsButton.first().waitFor({ state: 'visible', timeout: 15000 });
    console.log('Clicking NHSmail button...');
    await nhsButton.first().click();

    // Microsoft email input
    console.log('Step 4: Waiting for Microsoft email input (#i0116)...');
    const emailInput = page.locator('#i0116').or(page.locator('input[type="email"]'));
    await emailInput.first().waitFor({ state: 'visible', timeout: 20000 });
    console.log(`Entering username: ${username}`);
    await emailInput.first().fill(username);

    console.log('Clicking Next on Microsoft page...');
    await page.locator('#idSIButton9').or(page.getByRole('button', { name: /^next$/i })).first().click();

    console.log('\nStep 5: Waiting for redirection (Microsoft password or ADFS)...');
    await page.waitForTimeout(3000);

    const maxWait = Date.now() + 30000;
    while (Date.now() < maxWait) {
      const currentUrl = page.url();
      console.log(`[${new Date().toLocaleTimeString()}] Current URL: ${currentUrl}`);

      if (currentUrl.includes('fs.nhs.net')) {
        console.log('>>> LANDED ON fs.nhs.net ADFS! <<<');
        const pageTitle = await page.title();
        console.log('Page title:', pageTitle);

        // Inspect elements on page
        const dump = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
            id: el.id,
            name: el.name,
            type: el.type,
            value: el.value,
            visible: el.offsetParent !== null,
          }));
          const idps = Array.from(document.querySelectorAll('.idp, [role="button"]')).map((el) => ({
            text: el.innerText?.trim(),
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className,
            visible: el.offsetParent !== null,
          }));
          return { inputs, idps, bySelection: !!document.getElementById('bySelection'), byEmail: !!document.getElementById('byEmail') };
        });
        console.log('Page elements dump:', JSON.stringify(dump, null, 2));

        // Check if Active Directory IDP selection is present
        const adButton = page.locator('[aria-label="Active Directory"], .idp:has-text("Active Directory")').or(page.getByText('Active Directory', { exact: false }));
        const adVisible = await adButton.first().isVisible().catch(() => false);
        console.log('Is Active Directory button visible?', adVisible);

        if (adVisible) {
          console.log('Clicking Active Directory button...');
          await adButton.first().click();
          console.log('Clicked Active Directory! Waiting for page update...');
          await page.waitForTimeout(2000);
          continue;
        }

        // Check for passwordInput
        const pwField = page.locator('#passwordInput, input[type="password"]');
        const pwVisible = await pwField.first().isVisible().catch(() => false);
        console.log('Is #passwordInput visible?', pwVisible);

        if (pwVisible) {
          if (!password) {
            console.log('NO PASSWORD AVAILABLE to fill! Please check credentials.');
          } else {
            console.log('Filling password into #passwordInput...');
            await pwField.first().fill(password);
            console.log('Password filled successfully!');

            const submitBtn = page.locator('#submitButton').or(page.getByRole('button', { name: /sign in/i }));
            console.log('Submitting login...');
            await submitBtn.first().click();
            console.log('Submit clicked!');
            break;
          }
        }
      } else if (currentUrl.includes('login.microsoftonline.com')) {
        const msPw = page.locator('#i0118');
        if (await msPw.first().isVisible().catch(() => false)) {
          console.log('Microsoft password input #i0118 is visible!');
          if (password) {
            await msPw.first().fill(password);
            await page.locator('#idSIButton9').click();
            break;
          }
        }
      }

      await page.waitForTimeout(2000);
    }

    console.log('\n=== Inspection complete. Browser will remain open for 60 seconds ===');
    await page.waitForTimeout(60000);

  } catch (err) {
    console.error('Error during execution:', err);
    await page.screenshot({ path: 'screenshots/debug-error.png' }).catch(() => {});
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main().catch(console.error);
