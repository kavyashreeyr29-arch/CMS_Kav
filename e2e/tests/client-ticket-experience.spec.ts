import { test, expect } from '@playwright/test';

// Coverage for the client ticket-experience fixes documented in
// CHANGELOG.md — the "Raised via" default now maps through SOURCE_BY_ROLE
// instead of being hardcoded to CallCenter for every non-'all'-scope role,
// the internal watcher picker is hidden from clients, ticket creation uses
// SPA navigation instead of a hard reload, and an applicable SLA target is
// shown when one matches the selected project/priority.
test.describe('Client ticket-raising experience', () => {
  test('Client sees Client Portal as the read-only "Raised via" value, not Call Center', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();

    const sourceInput = page.locator('#ct-source');
    await expect(sourceInput).toHaveValue('ClientPortal');
  });

  test('Client does not see the internal watcher picker', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
    await expect(page.locator('#ct-watchers-label')).toHaveCount(0);
  });

  test('Selecting a priority with a matching org-wide SLA policy shows the expected-response note', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
    await page.locator('#ct-priority').selectOption('High');
    await expect(page.locator('.field-note')).toBeVisible();
    await expect(page.locator('.field-note')).toContainText('first response');
  });

  test('Creating a ticket navigates via SPA routing (no full page reload) and lands on the new ticket', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
    const title = `E2E client ticket ${Date.now()}`;
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(title);

    // Tag a marker on window before submitting — a hard reload (the old
    // window.location.assign behavior) would wipe it, an SPA navigate()
    // would not.
    await page.evaluate(() => { (window as unknown as Record<string, unknown>).__e2eMarker = true; });
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });
    await expect(page.locator('.ticket-detail-main')).toContainText(title);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__e2eMarker)).toBe(true);
  });
});
