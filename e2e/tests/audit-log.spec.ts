import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the admin audit-log feature (CHANGELOG.md "admin activity
// logs") — every user/role mutation an admin makes is recorded with a
// before/after diff, distinct from the ticket-scoped Comms & tracking log.
test.describe('Admin audit log', () => {
  test('Admin sees the Audit log nav item', async ({ page }) => {
    await login(page);
    await expect(page.locator('.sidebar-nav a[href="/audit-log"]')).toBeVisible();
  });

  test('Director does not see the Audit log nav item', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Director', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/audit-log"]')).toHaveCount(0);
  });

  test('Editing a role\'s permissions on the Roles page shows an entry in the audit log', async ({ page }) => {
    await login(page);
    await page.goto('/roles');
    await page.getByText('QA', { exact: true }).click();
    const checkbox = page.locator('label', { hasText: 'Reopen a closed ticket' }).locator('input[type="checkbox"]');
    const wasChecked = await checkbox.isChecked();
    await checkbox.click();
    await page.locator('.btn-primary', { hasText: 'Save permissions' }).click();
    await expect(page.locator('.field-error')).toHaveCount(0);

    await page.goto('/audit-log');
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('QA');
    await expect(row.locator('.label-chip')).toContainText('Role permissions updated');

    // Revert so the test is idempotent across reruns.
    await page.goto('/roles');
    await page.getByText('QA', { exact: true }).click();
    const revertCheckbox = page.locator('label', { hasText: 'Reopen a closed ticket' }).locator('input[type="checkbox"]');
    if ((await revertCheckbox.isChecked()) !== wasChecked) await revertCheckbox.click();
    await page.locator('.btn-primary', { hasText: 'Save permissions' }).click();
  });
});
