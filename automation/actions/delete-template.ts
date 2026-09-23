import type { Page, Locator } from 'playwright-core';

export interface DeleteTemplateResult {
  success: boolean;
  deletedCount: number;
  /** True only when no template row matched the name exactly. */
  notFound: boolean;
  error?: string;
}

export interface DeleteTemplateOptions {
  /** Timeout for each UI wait (dialog, row removal). */
  timeoutMs?: number;
}

/** Rows whose text content contains a cell equal to `name` (exact, trimmed, case-sensitive). */
export function exactTemplateRows(page: Page, name: string): Locator {
  return page.locator('tr').filter({ has: page.getByText(name, { exact: true }) });
}

async function waitForCount(locator: Locator, predicate: (n: number) => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate(await locator.count())) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for template row to be removed`);
}

export async function deleteTemplate(
  page: Page,
  templateName: string,
  opts: DeleteTemplateOptions = {},
): Promise<DeleteTemplateResult> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const rows = exactTemplateRows(page, templateName);
  let deleted = 0;

  try {
    const initial = await rows.count();
    if (initial === 0) {
      return { success: false, deletedCount: 0, notFound: true, error: `No template "${templateName}" found` };
    }

    // Re-resolve the locator every iteration; never hold a reference to a removed row.
    for (let i = 0; i < initial; i++) {
      const before = await rows.count();
      if (before === 0) break;

      await rows.first().getByRole('button', { name: /delete/i }).click({ timeout: timeoutMs });

      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: /delete/i }).click({ timeout: timeoutMs });

      await waitForCount(rows, (n) => n < before, timeoutMs);
      deleted++;
    }

    return { success: true, deletedCount: deleted, notFound: false };
  } catch (error) {
    return {
      success: false,
      deletedCount: deleted,
      notFound: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
