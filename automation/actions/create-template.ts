import type { Page } from 'playwright-core';

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

export async function createTemplate(
  page: Page,
  template: TemplateConfig,
): Promise<CreateTemplateResult> {
  try {
    const existingRow = page.locator(`tr:has(th:text-is("${template.template_name}"))`);
    const exists = await existingRow.count() > 0;

    if (exists) {
      return { success: false, alreadyExists: true };
    }

    const createLink = page.getByRole('link', { name: /create template/i })
      .or(page.locator('a[href*="templates/create"]'));
    await createLink.click();

    const nameInput = page.getByLabel(/template name/i).or(page.locator('#templateName'));
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(template.template_name);

    const messageInput = page.getByLabel(/message/i).or(page.locator('#message'));
    await messageInput.fill(template.message);

    await setCheckbox(page, '#sendViaIndividualMessaging', template.individual);
    await setCheckbox(page, '#sendViaBatchMessaging', template.batch);
    await setCheckbox(page, '#allowPatientsToRespond', template.allow_respond);

    const saveButton = page.getByRole('button', { name: /save/i })
      .or(page.locator('button[type="submit"]'));
    await saveButton.click();

    await page.waitForTimeout(2000);

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
  const isChecked = await checkbox.isChecked();
  if (isChecked !== shouldBeChecked) {
    await checkbox.click();
  }
}
