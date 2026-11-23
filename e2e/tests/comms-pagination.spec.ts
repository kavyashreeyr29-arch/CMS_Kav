import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for Comms & Tracking pagination + CSV export (CHANGELOG.md) —
// the log used to dump up to 100 rows flat with no way to see just the
// recent activity. Now shows the most recent 10 by default, with a
// View all/Show less toggle and a CSV download of everything fetched.
test.describe('Comms & Tracking pagination and export', () => {
  test('shows at most 10 rows by default with a View all toggle, and a CSV download button', async ({ page }) => {
    await login(page);
    await page.goto('/comms');

    const table = page.locator('.data-table').last();
    await expect(table.locator('tbody tr').first()).toBeVisible();
    const initialRowCount = await table.locator('tbody tr').count();
    expect(initialRowCount).toBeLessThanOrEqual(10);

    const viewAllBtn = page.locator('.btn-ghost', { hasText: /View all \d+/ });
    if (await viewAllBtn.count() > 0) {
      await viewAllBtn.click();
      const expandedRowCount = await table.locator('tbody tr').count();
      expect(expandedRowCount).toBeGreaterThan(initialRowCount);
      await page.locator('.btn-ghost', { hasText: 'Show less' }).click();
      await expect(table.locator('tbody tr')).toHaveCount(initialRowCount);
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.panel-head .btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('comms-tracking-log.csv');
  });
});
