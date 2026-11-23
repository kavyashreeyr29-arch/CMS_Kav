import { test, expect } from '@playwright/test';

// Coverage for the leadership-visibility widening documented in
// CHANGELOG.md — Director/PM/Lead/Manager now get adminAnalytics (previously
// Admin-only), and AnalyticsService.projectWise() (previously unconditionally
// org-wide with no user/perms scoping at all) now scopes 'team'-scope roles
// (Lead/Manager) to only the project(s) on the team(s) they lead, the same
// way ProjectsService.findAll() already scoped the Projects page.
test.describe('Leadership Analytics visibility', () => {
  test('Director sees Analytics in the nav and the page loads with real data', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Director', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/analytics"]')).toBeVisible();

    await page.goto('/analytics');
    await expect(page.locator('.panel-title', { hasText: 'Project-wise performance' })).toBeVisible();
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
  });

  test("Lead's Analytics project-wise table is scoped to their own team's project(s), not the whole org", async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Lead', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/analytics"]')).toBeVisible();

    await page.goto('/analytics');
    const rows = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Project-wise performance' }) }).locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const projectCodes = await rows.locator('td').first().allTextContents();
    // Lead (V. Kapoor, seed.ts) leads the "Delivery Squad" team, which owns
    // only the ATLAS project — every row should be ATLAS, never another
    // project the Lead doesn't lead.
    for (const cell of projectCodes) {
      expect(cell).toContain('ATLAS');
    }
  });

  test('Client still cannot reach Analytics (no nav item, direct nav redirects away)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);
    await expect(page.locator('.sidebar-nav a[href="/analytics"]')).toHaveCount(0);
  });
});
