import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for admin-manageable Business Categories (CHANGELOG.md) — was a
// fixed 3-value Prisma enum, now a real admin CRUD list mirroring Labels.
test.describe('Business categories admin', () => {
  test('Admin can add a business category and it appears in the ticket-creation picker', async ({ page }) => {
    await login(page);
    await page.goto('/business-categories');
    await expect(page.locator('.panel-title', { hasText: 'Business categories' })).toBeVisible();

    const categoryName = `E2E Category ${Date.now()}`;
    await page.locator('.filter-bar input').fill(categoryName);
    await page.locator('.btn-primary', { hasText: 'Add category' }).click();
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.locator('.sidebar-nav a[href="/tickets"]').click();
    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
    const categorySelect = page.locator('.modal .field:has(label:text-is("Business category")) select');
    await expect(categorySelect.locator('option', { hasText: categoryName })).toBeAttached();
  });

  test('Removing a category takes it out of the ticket-creation picker', async ({ page }) => {
    await login(page);
    await page.goto('/business-categories');

    const categoryName = `E2E Removable ${Date.now()}`;
    await page.locator('.filter-bar input').fill(categoryName);
    await page.locator('.btn-primary', { hasText: 'Add category' }).click();
    const chip = page.locator('.label-chip', { hasText: categoryName });
    await expect(chip).toBeVisible();
    // The chip and its "Remove" button are siblings under the same row div
    // — go up to that row rather than searching for a `div` containing both
    // (which also matches every ancestor up to `#root`, since `hasText`
    // matches anywhere in the subtree).
    const row = chip.locator('xpath=..');
    await row.locator('button[title="Remove category"]').click();
    await expect(page.getByText(categoryName)).toHaveCount(0);
  });
});
