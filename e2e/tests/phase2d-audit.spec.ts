import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the "PRD Phase 2d" batch documented in CHANGELOG.md — Team
// Hours date-range picker + member filter + view-history drawer, and CSV
// export wired into Team Hours, the ticket list, Analytics, and SLA policies.
test.describe('Phase 2d — Team Hours & CSV export', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Team hours shows a date range + member filter for an org-visibility role, and view-history opens a drawer', async ({ page }) => {
    await page.goto('/work-hours');
    const dateInputs = page.locator('.panel-head input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await expect(page.locator('.panel-head select')).toBeVisible();

    const firstRow = page.locator('.wl-row').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page.locator('.modal-title', { hasText: 'time logged' })).toBeVisible();
    // Date now leads (CHANGELOG.md "time logged... which date he has worked
    // on it") — each row is a distinct timer session, not an aggregate.
    await expect(page.locator('.modal .data-table thead th').first()).toHaveText('Date');
    await page.locator('.modal-close').click();
  });

  test('Team hours CSV export triggers a real file download', async ({ page }) => {
    await page.goto('/work-hours');
    await expect(page.locator('.wl-row').first()).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.panel-head .btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/team-hours-.*\.csv/);
  });

  test('Ticket list CSV export triggers a real file download', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.filter-bar .btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('tickets.csv');
  });

  test('SLA policies CSV export triggers a real file download', async ({ page }) => {
    await page.goto('/sla-policies');
    await expect(page.locator('.panel-title', { hasText: 'SLA policies' })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.panel-head .btn-ghost', { hasText: 'CSV', hasNotText: 'Import' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('sla-policies.csv');
  });
});
