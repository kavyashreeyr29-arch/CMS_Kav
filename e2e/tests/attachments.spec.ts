import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Covers the real MinIO-backed upload/download flow (backend/src/storage) —
// this used to be a stub that returned unreachable placeholder URLs.
test.describe('Attachments', () => {
  test('uploading a file to a ticket shows it and downloads via a real signed URL', async ({ page, context }) => {
    await login(page);
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    const fileName = `e2e-${Date.now()}.txt`;
    // Ticket detail now has two upload areas (general attachments + QA test
    // evidence, docs/prd-phase2.md §12) — scope to the general one.
    const attachmentsPanel = page.locator('.panel', { has: page.locator('.td-section-title', { hasText: 'Attachments (' }) });
    await attachmentsPanel.locator('input[type=file]').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('e2e attachment test content'),
    });

    const attachmentCard = page.locator('.att-card', { hasText: fileName });
    await expect(attachmentCard).toBeVisible({ timeout: 20000 });

    const [downloadPage] = await Promise.all([
      context.waitForEvent('page'),
      attachmentCard.locator('.att-download').click(),
    ]);
    await downloadPage.waitForLoadState();
    // A real presigned MinIO URL, not the old unreachable https://storage.local stub.
    expect(downloadPage.url()).toContain('X-Amz-Signature');
    await downloadPage.close();
  });

  test('uploading a document to a project shows it in the document folder', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.locator('.proj-card').first().click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    // Basecamp-style restructure (CHANGELOG.md) moved Docs & Files off the
    // default Overview tab into its own tab.
    await page.locator('.proj-tab-bar').getByText('Docs & Files').click();

    const fileName = `e2e-doc-${Date.now()}.txt`;
    await page.locator('input[type=file]').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('e2e project document content'),
    });

    await expect(page.locator('.att-card', { hasText: fileName })).toBeVisible({ timeout: 20000 });
  });
});
