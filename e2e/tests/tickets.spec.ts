import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Tickets', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ticket list loads seeded rows and opens a detail page', async ({ page }) => {
    await page.locator('.sidebar-nav').getByText('Tickets').click();
    await expect(page).toHaveURL(/\/tickets$/);

    const firstRow = page.locator('table.data-table tbody tr').first();
    await expect(firstRow).toBeVisible();
    const displayId = await firstRow.locator('.tid').textContent();

    await firstRow.click();
    await expect(page).toHaveURL(/\/tickets\/.+/);
    await expect(page.locator('.tid').first()).toHaveText(displayId ?? '');
  });

  test('status change on a ticket persists after reload', async ({ page }) => {
    // Create a fresh Open ticket so the transition is deterministic under the
    // configurable workflow (the status picker now only offers valid targets
    // from the current status — Open → InProgress is a default transition).
    await page.goto('/tickets');
    await page.getByRole('button', { name: 'New ticket' }).click();
    const title = `E2E status-persist ${Date.now()}`;
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(title);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });

    const statusSelect = page.locator('#td-status');
    await statusSelect.selectOption('InProgress');
    await expect(page.locator('#td-status')).toHaveValue('InProgress');

    await page.reload();
    await expect(page.locator('#td-status')).toHaveValue('InProgress');
  });

  test('creating a ticket via the New ticket modal shows it in the list', async ({ page }) => {
    await page.goto('/tickets');
    await page.getByRole('button', { name: 'New ticket' }).click();
    await expect(page.locator('.modal-title')).toHaveText('New ticket');

    const title = `E2E smoke ticket ${Date.now()}`;
    await page.locator('.modal-body input').first().fill(title);
    await page.getByRole('button', { name: /create & notify/i }).click();

    await expect(page).toHaveURL(/\/tickets\/.+/);
    await expect(page.getByText(title)).toBeVisible();
  });
});
