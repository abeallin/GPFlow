import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Browser, Page } from 'playwright-core';
import { deleteTemplate } from '../../../automation/actions/delete-template';
import { launchBrowser, templatesPageHtml, remainingNames, servePage } from './fixtures';

describe('deleteTemplate', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => { browser = await launchBrowser(); }, 60000);
  afterAll(async () => { await browser?.close(); });

  it('deletes only the row whose name matches exactly, not rows containing the name', async () => {
    page = await browser.newPage();
    await servePage(page, templatesPageHtml(['Flu', 'Flu 2024', 'Flu jab reminder']));

    const result = await deleteTemplate(page, 'Flu');

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(1);
    expect(await remainingNames(page)).toEqual(['Flu 2024', 'Flu jab reminder']);
    await page.close();
  }, 30000);
});

describe('deleteTemplate result classification', () => {
  let browser: Browser;
  beforeAll(async () => { browser = await launchBrowser(); }, 60000);
  afterAll(async () => { await browser?.close(); });

  it('reports notFound when no row matches exactly', async () => {
    const page = await browser.newPage();
    await servePage(page, templatesPageHtml(['Flu 2024']));
    const result = await deleteTemplate(page, 'Flu');
    expect(result.success).toBe(false);
    expect(result.notFound).toBe(true);
    expect(result.deletedCount).toBe(0);
    await page.close();
  }, 30000);

  it('does NOT report notFound when the row exists but deletion fails', async () => {
    const page = await browser.newPage();
    // Row exists, but the confirm dialog never appears — a broken page, not a missing template
    const html = templatesPageHtml(['Flu']).replace("dlg.setAttribute('role', 'dialog');", '');
    await servePage(page, html);
    const result = await deleteTemplate(page, 'Flu', { timeoutMs: 1500 });
    expect(result.success).toBe(false);
    expect(result.notFound).toBe(false);
    expect(result.error).toBeTruthy();
    await page.close();
  }, 30000);
});
