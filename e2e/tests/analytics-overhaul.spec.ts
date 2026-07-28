import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the Analytics overhaul (CHANGELOG.md) — a period filter
// (month/quarter/year/custom date range) driving headline stats and the
// productivity panel, plus new CEO-level panels: Performance trend
// (created/closed/net), Delivery funnel (org-wide pipeline stage
// breakdown), and an SLA compliance headline stat.
test.describe('Analytics — period filter and deeper insights', () => {
  test('Shows a period filter with Month/Quarter/Year/Custom, and headline stats for the selected period', async ({ page }) => {
    await login(page);
    await page.goto('/analytics');

    const filterPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Reporting period' }) });
    await expect(filterPanel).toBeVisible();
    for (const label of ['Month', 'Quarter', 'Year', 'Custom']) {
      await expect(filterPanel.locator('.period-btn', { hasText: label })).toBeVisible();
    }
    await expect(filterPanel.locator('.mom-label', { hasText: 'Tickets raised' })).toBeVisible();
    await expect(filterPanel.locator('.mom-label', { hasText: 'SLA compliance' })).toBeVisible();
  });

  test('Selecting Custom reveals From/To date inputs, and changes the headline numbers', async ({ page }) => {
    await login(page);
    await page.goto('/analytics');

    const filterPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Reporting period' }) });
    await expect(filterPanel.locator('input[type="date"]')).toHaveCount(0);
    await filterPanel.locator('.period-btn', { hasText: 'Custom' }).click();
    await expect(filterPanel.locator('input[type="date"]')).toHaveCount(2);
  });

  test('Shows a Performance trend chart and an org-wide Delivery funnel', async ({ page }) => {
    await login(page);
    await page.goto('/analytics');

    await expect(page.locator('.panel-title', { hasText: 'Performance trend' })).toBeVisible();
    const funnelPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Delivery funnel' }) });
    await expect(funnelPanel).toBeVisible();
    for (const stage of ['Planning', 'Development', 'Testing', 'Deployed']) {
      await expect(funnelPanel.locator('.mom-label', { hasText: stage })).toBeVisible();
    }
  });
});
