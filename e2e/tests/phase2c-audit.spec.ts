import { Page, test, expect } from '@playwright/test';
import { login } from './fixtures';

function fieldControl(page: Page, labelText: string) {
  return page.locator(`.modal .field:has(label:text-is("${labelText}")) select, .modal .field:has(label:text-is("${labelText}")) input`);
}

// Coverage for the "PRD Phase 2c" batch documented in CHANGELOG.md —
// Business Category, the Dashboard's Raised-by-source split, the ageing
// heatmap's SLA drill-down, and the Analytics productivity panels.
test.describe('Phase 2c — analytics depth', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Business category is selectable when creating a ticket and shows on the created ticket', async ({ page }) => {
    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
    await expect(fieldControl(page, 'Project').locator('option').first()).toBeAttached();
    await fieldControl(page, 'Title').fill(`E2E biz category ${Date.now()}`);
    await fieldControl(page, 'Business category').selectOption('InnovateX');
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });
    await expect(page.locator('.ticket-detail-side')).toContainText('InnovateX');
  });

  // Superseded by the "Tickets raised by" role-category breakdown
  // (CHANGELOG.md) — see dashboard-analytics-split.spec.ts for its
  // coverage; this panel no longer exists under its old name/shape.
  test('Dashboard shows a Tickets raised by panel splitting volume by role category', async ({ page }) => {
    const panel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Tickets raised by' }) });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Client', { exact: true })).toBeVisible();
    await expect(panel.getByText('Tech', { exact: true })).toBeVisible();
  });

  test('Clicking a project row in the ageing heatmap drills into its SLA-breached tickets', async ({ page }) => {
    const firstRow = page.locator('.aging-table tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/tickets\?slaBreached=true/);
    await expect(page.locator('.restricted-banner', { hasText: 'breached their SLA' })).toBeVisible();
  });

  test('Analytics page shows productivity panels with real hours', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.locator('.panel-title', { hasText: 'Developer productivity' })).toBeVisible();
    await expect(page.locator('.panel-title', { hasText: 'Hours by business category' })).toBeVisible();
    const headers = page.locator('.data-table thead th');
    await expect(headers.getByText('Hours spent', { exact: true })).toBeVisible();
  });
});
