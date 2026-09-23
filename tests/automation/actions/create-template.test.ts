import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Browser } from 'playwright-core';
import { createTemplate } from '../../../automation/actions/create-template';
import { launchBrowser, templatesPageHtml, remainingNames, servePage } from './fixtures';

const template = { template_name: 'Flu', message: 'Book your flu jab', individual: true, batch: false, allow_respond: true };

describe('createTemplate', () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 60000);
  afterAll(async () => { await browser?.close(); });

  it('creates the template when only a longer name containing it exists', async () => {
    const page = await browser.newPage();
    await servePage(page, templatesPageHtml(['Flu 2024']));

    const result = await createTemplate(page, template);

    expect(result.alreadyExists).toBe(false);
    expect(result.success).toBe(true);
    expect(await remainingNames(page)).toEqual(['Flu 2024', 'Flu']);
    await page.close();
  }, 30000);

  it('detects an existing template even when the SPA renders the list after load', async () => {
    const page = await browser.newPage();
    await servePage(page, templatesPageHtml(['Flu'], { renderDelayMs: 800 }));

    const result = await createTemplate(page, template);

    expect(result.alreadyExists).toBe(true);
    expect(await page.evaluate(() => (window as any).__saves)).toBe(0);
    expect(await remainingNames(page)).toEqual(['Flu']);
    await page.close();
  }, 30000);

  it('fills the message field even though another label also contains the word "message"', async () => {
    const page = await browser.newPage();
    await servePage(page, templatesPageHtml([]));

    const result = await createTemplate(page, template);

    expect(result.success).toBe(true);
    expect(await page.evaluate(() => (window as any).__saves)).toBe(1);
    await page.close();
  }, 30000);
});
