import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the Users & Roles page redesign (CHANGELOG.md) — was one
// flat table with every user rendered at once; now grouped by department
// (baseRole.group), collapsed by default with a search box.
test.describe('Users page — department-grouped redesign', () => {
  test('Departments start collapsed as summary rows; clicking one expands its member table', async ({ page }) => {
    await login(page);
    await page.goto('/users');

    const fullAccessHeader = page.locator('.wl-row-btn', { hasText: 'Full access' });
    await expect(fullAccessHeader).toBeVisible();
    await expect(page.locator('.data-table')).toHaveCount(0);

    await fullAccessHeader.click();
    await expect(page.locator('.data-table').first()).toBeVisible();
    await expect(page.locator('.data-table thead th').first()).toHaveText('Name');

    await fullAccessHeader.click();
    await expect(page.locator('.data-table')).toHaveCount(0);
  });

  test('Searching by name filters across departments and auto-expands matches', async ({ page }) => {
    await login(page);
    await page.goto('/users');
    await expect(page.locator('.data-table')).toHaveCount(0);

    await page.locator('.filter-bar .search-box input').fill('P. Manager');
    await expect(page.locator('.data-table')).toHaveCount(1);
    await expect(page.locator('.data-table').getByText('P. Manager', { exact: true })).toBeVisible();
  });
});
