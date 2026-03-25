import type { Page } from 'playwright-core';

export interface DeleteTemplateResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

export async function deleteTemplate(
  page: Page,
  templateName: string,
): Promise<DeleteTemplateResult> {
  try {
    const rows = page.locator(`tr:has(th:text-is("${templateName}"))`);
    const count = await rows.count();

    if (count === 0) {
      return { success: false, deletedCount: 0, error: `No template "${templateName}" found` };
    }

    let deleted = 0;

    for (let i = 0; i < count; i++) {
      const row = rows.first();

      const deleteBtn = row.getByRole('button', { name: /delete/i });
      await deleteBtn.click();

      const dialog = page.getByRole('dialog');
      const confirmBtn = dialog.getByRole('button', { name: /delete/i });
      await confirmBtn.click();

      await row.waitFor({ state: 'detached', timeout: 10000 });
      deleted++;
    }

    return { success: true, deletedCount: deleted };
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
