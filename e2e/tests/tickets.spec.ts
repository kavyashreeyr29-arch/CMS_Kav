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
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    const statusSelect = page.locator('.td-meta-item select').first();
    await statusSelect.selectOption('InReview');
    await expect(page.locator('.td-meta-item select').first()).toHaveValue('InReview');

    await page.reload();
    await expect(page.locator('.td-meta-item select').first()).toHaveValue('InReview');
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
