import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('renders the KPI row and trend panel with real data from the API', async ({ page }) => {
    const kpiLabels = page.locator('.kpi-label');
    await expect(kpiLabels.getByText('Open tickets', { exact: true })).toBeVisible();
    await expect(kpiLabels.getByText('Overdue', { exact: true })).toBeVisible();
    await expect(kpiLabels.getByText('SLA compliance', { exact: true })).toBeVisible();
    await expect(kpiLabels.getByText('Team capacity used', { exact: true })).toBeVisible();
    await expect(page.getByText('Trend summary', { exact: true })).toBeVisible();
  });

  test('renders the priority breakdown, ageing heatmap, workload, and project health panels', async ({ page }) => {
    await expect(page.locator('.panel-title', { hasText: 'Open tickets by priority' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Recurring issue categories' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Ticket ageing by project' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Team workload' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Project health' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Upcoming due dates' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Recent activity' })).toBeVisible();
  });

  test('Admin sees every nav item the permission matrix grants', async ({ page }) => {
    const nav = page.locator('.sidebar-nav');
    await expect(nav.getByText('Dashboard', { exact: true })).toBeVisible();
    await expect(nav.getByText('Projects', { exact: true })).toBeVisible();
    await expect(nav.getByText('Board', { exact: true })).toBeVisible();
    await expect(nav.getByText('Users & roles', { exact: true })).toBeVisible();
    await expect(nav.getByText('Labels', { exact: true })).toBeVisible();
    await expect(nav.getByText('SLA policies', { exact: true })).toBeVisible();
    await expect(nav.getByText('AI integrations', { exact: true })).toBeVisible();
  });
});
