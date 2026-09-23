import type { Page } from 'playwright-core';
import { exactTemplateRows } from './delete-template';

export interface TemplateConfig {
  template_name: string;
  message: string;
  individual: boolean;
  batch: boolean;
  allow_respond: boolean;
}

export interface CreateTemplateResult {
  success: boolean;
  alreadyExists: boolean;
  error?: string;
}

export interface CreateTemplateOptions {
  /** Timeout for each UI wait (list render, form, save). */
  timeoutMs?: number;
}

export async function createTemplate(
  page: Page,
  template: TemplateConfig,
  opts: CreateTemplateOptions = {},
): Promise<CreateTemplateResult> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  try {
    // The list is rendered client-side after load. The "Create template" link is part of
    // the same view, so once it is visible the existing rows have been rendered too.
    const createLink = page.getByRole('link', { name: /create template/i })
      .or(page.locator('a[href*="templates/create"]'));
    await createLink.first().waitFor({ state: 'visible', timeout: timeoutMs });

    // Exact (trimmed, case-sensitive) name match — never a substring match.
    if (await exactTemplateRows(page, template.template_name).count() > 0) {
      return { success: false, alreadyExists: true };
    }

    await createLink.first().click();

    const nameInput = page.getByLabel(/^template name$/i).or(page.locator('#templateName'));
    await nameInput.first().waitFor({ state: 'visible', timeout: timeoutMs });
    await nameInput.first().fill(template.template_name);

    // "Allow patients to respond to this message" also matches /message/i, so anchor the label.
    const messageInput = page.locator('#message').or(page.getByLabel(/^message( body)?$/i));
    await messageInput.first().fill(template.message);

    await setCheckbox(page, '#sendViaIndividualMessaging', template.individual);
    await setCheckbox(page, '#sendViaBatchMessaging', template.batch);
    await setCheckbox(page, '#allowPatientsToRespond', template.allow_respond);

    const saveButton = page.getByRole('button', { name: /save/i })
      .or(page.locator('button[type="submit"]'));
    await saveButton.first().click();

    // Verify creation: the new row must appear in the list (URL alone is not proof).
    await exactTemplateRows(page, template.template_name).first()
      .waitFor({ state: 'visible', timeout: timeoutMs });

    return { success: true, alreadyExists: false };
  } catch (error) {
    return {
      success: false,
      alreadyExists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function setCheckbox(page: Page, selector: string, shouldBeChecked: boolean): Promise<void> {
  const checkbox = page.locator(selector);
  if (await checkbox.count() === 0) return;
  const isChecked = await checkbox.isChecked();
  if (isChecked !== shouldBeChecked) {
    await checkbox.click();
  }
}
