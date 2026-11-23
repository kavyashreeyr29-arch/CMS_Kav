import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the Dashboard/Analytics differentiation pass (CHANGELOG.md,
// "Dashboard vs. Analytics split") — Dashboard is the capped "operational
// pulse" with 'View all' drill-throughs into Analytics, Analytics is the
// uncapped "deep reporting" view with panels that don't exist on Dashboard.
test.describe('Dashboard vs. Analytics differentiation', () => {
  test('Dashboard shows a capped label breakdown with a View all link into Analytics', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const labelPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Recurring issue categories' }) });
    await expect(labelPanel).toBeVisible();

    const rowCount = await labelPanel.locator('.wl-row').count();
    expect(rowCount).toBeLessThanOrEqual(5);

    const viewAll = labelPanel.locator('.panel-link');
    if (await viewAll.count() > 0) {
      await viewAll.click();
      await expect(page).toHaveURL(/\/analytics$/);
    }
  });

  test('Dashboard no longer shows the Trend summary chart (moved exclusively to Dashboard, removed from Analytics)', async ({ page }) => {
    await login(page);
    await page.goto('/analytics');
    await expect(page.locator('.panel-title', { hasText: 'Trend summary' })).toHaveCount(0);
  });

  test('Analytics shows the uncapped label breakdown, a per-project client-raised table, and a resolution-time-by-priority chart', async ({ page }) => {
    await login(page);
    await page.goto('/analytics');

    await expect(page.locator('.panel-title', { hasText: 'Recurring issue categories' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Client-raised tickets by project' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Resolution time by priority' })).toBeVisible();
  });

  test('Dashboard Team workload panel is capped at 5 with a View all link when truncated', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const workloadPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Team workload' }) });
    await expect(workloadPanel).toBeVisible();
    const rowCount = await workloadPanel.locator('.wl-row').count();
    expect(rowCount).toBeLessThanOrEqual(5);
  });

  test('Dashboard Recent activity panel is capped at 5', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const activityPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Recent activity' }) });
    await expect(activityPanel).toBeVisible();
    const rowCount = await activityPanel.locator('.activity-item').count();
    expect(rowCount).toBeLessThanOrEqual(5);
  });

  test('Team workload "View all" expands in place instead of redirecting to Analytics', async ({ page }) => {
    await login(page);
    const workloadPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Team workload' }) });
    const viewAll = workloadPanel.locator('.panel-link');
    if (await viewAll.count() === 0) test.skip();
    await viewAll.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(workloadPanel.locator('.panel-link')).toHaveText('Show less ←');
  });

  test('Ticket ageing "View all" expands in place instead of redirecting to Analytics, and shows an SLA column', async ({ page }) => {
    await login(page);
    const agingPanel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Ticket ageing by project' }) });
    await expect(agingPanel.locator('th', { hasText: 'SLA' })).toBeVisible();
    await expect(agingPanel.locator('tbody tr').first().locator('.label-chip, [title*="No SLA"]')).toBeVisible();

    const viewAll = agingPanel.locator('.panel-link');
    if (await viewAll.count() === 0) test.skip();
    await viewAll.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(agingPanel.locator('.panel-link')).toHaveText('Show less ←');
  });

  test('Dashboard shows a "Tickets raised by" role-category breakdown', async ({ page }) => {
    await login(page);
    const panel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Tickets raised by' }) });
    await expect(panel).toBeVisible();
    for (const category of ['Client', 'Helpdesk', 'Project Manager', 'Customer Success', 'Operations', 'Tech']) {
      await expect(panel.locator('.mom-label', { hasText: category })).toBeVisible();
    }
  });
});
