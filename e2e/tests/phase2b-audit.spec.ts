import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the "PRD Phase 2b" batch documented in CHANGELOG.md —
// status-gated ticket editing, the field-level change history panel, the
// two-pane ticket detail layout, and the Age/Idle ageing split.
test.describe('Phase 2b — edit & audit', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Editing an Open ticket updates its title and records a change-history entry', async ({ page }) => {
    await page.goto('/tickets?status=Open');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    const editBtn = page.locator('.btn-ghost', { hasText: 'Edit' });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const newTitle = `Edited title ${Date.now()}`;
    const titleInput = page.locator('.ticket-detail-main .field.full input').first();
    await titleInput.fill(newTitle);
    await page.locator('.btn-primary', { hasText: 'Save changes' }).click();

    await expect(page.locator('.ticket-detail-main')).toContainText(newTitle);
    const historyPanel = page.locator('.panel', { has: page.locator('.td-section-title', { hasText: 'Change history' }) });
    await expect(historyPanel).toContainText('Title');
    await expect(historyPanel).toContainText(newTitle);
  });

  test('A ticket past Open has no Edit button and the server rejects a direct PATCH', async ({ page, request }) => {
    await page.goto('/tickets?status=InReview');
    await expect(page.locator('.loading-state')).toHaveCount(0, { timeout: 15000 });
    const row = page.locator('table.data-table tbody tr').first();
    const rowCount = await row.count();
    if (rowCount === 0 || !(await row.isVisible().catch(() => false))) test.skip();
    await row.click();
    await expect(page).toHaveURL(/\/tickets\/.+/);
    await expect(page.locator('.btn-ghost', { hasText: 'Edit' })).not.toBeVisible();

    const ticketId = page.url().split('/tickets/')[1];
    const token = await page.evaluate(() => localStorage.getItem('elevatohub_token'));
    const res = await request.patch(`http://localhost:3000/api/v1/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Should be rejected' },
    });
    expect(res.status()).toBe(403);
  });

  test('Ticket detail renders as a two-pane layout with a sticky side panel', async ({ page }) => {
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);
    await expect(page.locator('.ticket-detail-main')).toBeVisible();
    await expect(page.locator('.ticket-detail-side')).toBeVisible();
    await expect(page.locator('.ticket-detail-side .td-section-title', { hasText: 'Change history' })).toBeVisible();
  });

  test('Ticket list shows both Age and Idle columns', async ({ page }) => {
    await page.goto('/tickets');
    const headers = page.locator('.data-table thead th');
    await expect(headers.getByText('Age', { exact: true })).toBeVisible();
    await expect(headers.getByText('Idle', { exact: true })).toBeVisible();
  });
});
