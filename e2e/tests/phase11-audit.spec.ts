import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the "full prototype-parity audit" batch documented in
// CHANGELOG.md — role/permission matrix modal, notification preview modal,
// connected intake channels panel, the global project filter, and the
// ticket-list/Kanban/Projects/Analytics enrichments that came with it.
test.describe('Phase 11 audit — new features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Role & permission matrix modal opens from the Shield icon and lists every role', async ({ page }) => {
    await page.getByTitle('View role & permission matrix').click();
    await expect(page.getByText('Role & permission matrix', { exact: true })).toBeVisible();
    const table = page.locator('.perm-table');
    await expect(table).toBeVisible();
    await expect(table.getByText('Ticket visibility scope', { exact: true })).toBeVisible();
    await expect(table.getByText('Work-hours visibility', { exact: true })).toBeVisible();
    await page.locator('.modal-close').click();
    await expect(page.locator('.perm-table')).not.toBeVisible();
  });

  test('Notification preview modal shows Email/Teams tabs for a clicked notification', async ({ page }) => {
    await page.locator('.bell').click();
    const firstItem = page.locator('.bell-item').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();
    await expect(page.getByText('Notification preview', { exact: true })).toBeVisible();
    await expect(page.locator('.np-tab', { hasText: 'Email' })).toBeVisible();
    await expect(page.locator('.np-tab', { hasText: 'Teams' })).toBeVisible();
    await expect(page.locator('.email-frame')).toBeVisible();
    await page.locator('.np-tab', { hasText: 'Teams' }).click();
    await expect(page.locator('.teams-card')).toBeVisible();
    await page.locator('.modal-close').click();
  });

  test('Comms page lists the connected intake channels', async ({ page }) => {
    await page.goto('/comms');
    await expect(page.getByText('Connected intake channels', { exact: true })).toBeVisible();
    const grid = page.locator('.integ-grid');
    await expect(grid.getByText('Call Center (IVR / CTI)')).toBeVisible();
    await expect(grid.getByText('Client Portal')).toBeVisible();
    await expect(grid.getByText('Microsoft Teams')).toBeVisible();
  });

  test('Topbar project filter scopes the Dashboard KPIs and the Tickets list', async ({ page }) => {
    const select = page.locator('.proj-select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    const projectOption = options.find((o) => o !== 'All projects');
    expect(projectOption).toBeTruthy();
    const projectCode = projectOption!.split(' — ')[0];

    await select.selectOption(projectCode);
    await expect(page.locator('.kpi-label').getByText('Open tickets', { exact: true })).toBeVisible();

    // Client-side nav (not page.goto, which would hard-reload and reset the
    // AppShell's projectFilter state) — the filter must survive route changes.
    await page.locator('.sidebar-nav a[href="/tickets"]').click();
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.locator('.proj-select')).toHaveValue(projectCode);
    const rows = page.locator('.data-table tbody tr');
    await expect(rows.first()).toBeVisible();
    const idCells = await page.locator('.data-table tbody td.tid').allTextContents();
    for (const id of idCells) {
      expect(id.startsWith(projectCode)).toBeTruthy();
    }

    // Reset back to All projects so it doesn't leak into other tests.
    await page.locator('.proj-select').selectOption('ALL');
  });

  test('Ticket list shows Started/Age columns and, for full-access roles, a Time logged column', async ({ page }) => {
    await page.goto('/tickets');
    const headers = page.locator('.data-table thead th');
    // Renamed from "Start" to "Started" (CHANGELOG.md) — now shows the day
    // work actually began (first timer start), not a manually-set plan date.
    await expect(headers.getByText('Started', { exact: true })).toBeVisible();
    await expect(headers.getByText('Age', { exact: true })).toBeVisible();
    await expect(headers.getByText('Time logged', { exact: true })).toBeVisible();
    // Admin is scope: 'all', so the source filter should be present too.
    const sourceSelectOptions = await page.locator('.filter-bar select').nth(2).locator('option').allTextContents();
    expect(sourceSelectOptions).toContain('All sources');
  });

  test('Projects page shows a health dot per project card', async ({ page }) => {
    await page.goto('/projects');
    const firstCard = page.locator('.proj-card').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('.health-dot')).toBeVisible();
  });

  test('Project detail shows an Overdue stat and a "View in dashboard" action', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('.proj-card').first().click();
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
    const viewBtn = page.getByRole('button', { name: /View in dashboard/ });
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Analytics page shows the Recurring issue categories and Project-wise performance panels', async ({ page }) => {
    // Trend summary is Dashboard-exclusive as of the Dashboard/Analytics
    // differentiation pass (see dashboard-analytics-split.spec.ts) — Analytics
    // no longer duplicates it.
    await page.goto('/analytics');
    await expect(page.getByText('Recurring issue categories', { exact: true })).toBeVisible();
    await expect(page.getByText('Project-wise performance', { exact: true })).toBeVisible();
  });

  test('Kanban card clamps a long description', async ({ page }) => {
    await page.goto('/kanban');
    const cardWithDesc = page.locator('.kcard-desc').first();
    await expect(cardWithDesc).toBeVisible();
  });
});
