import { test, expect } from '@playwright/test';

// Coverage for the "Campaign & promotion tickets" summary panel on Analytics
// (CHANGELOG.md) — org-wide monthly/quarterly/yearly counts of tickets
// linked to a Campaign, restricted to admin/director/lead/pm/customersuccess.
// Customer Success previously had no path to Analytics at all
// (adminAnalytics was false) — widened specifically so this panel is
// actually reachable for them, not just permitted in theory.
test.describe('Campaign summary — Analytics visibility', () => {
  test('Admin sees the Campaign & promotion tickets panel', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.goto('/analytics');
    await expect(page.locator('.panel-title', { hasText: 'Campaign & promotion tickets' })).toBeVisible();
  });

  test('Customer Success now has an Analytics nav item and sees the panel', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Customer Success', exact: true }).click();
    await page.waitForURL(/\/(my-board|board)$/);
    await expect(page.locator('.sidebar-nav a[href="/analytics"]')).toBeVisible();

    await page.goto('/analytics');
    await expect(page.locator('.panel-title', { hasText: 'Campaign & promotion tickets' })).toBeVisible();
  });

  test('Call Center Agent (source-scope, not in the allowed list) does not see the panel or a nav item', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Call Center Agent', exact: true }).click();
    await page.waitForURL(/\/my-board$/);
    await expect(page.locator('.sidebar-nav a[href="/analytics"]')).toHaveCount(0);
  });

  test('Client cannot reach the panel', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);
    await expect(page.locator('.sidebar-nav a[href="/analytics"]')).toHaveCount(0);
  });
});
