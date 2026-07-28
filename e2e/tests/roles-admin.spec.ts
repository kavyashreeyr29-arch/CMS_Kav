import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the dynamic-RBAC admin UI documented in CHANGELOG.md —
// admins can create a custom role with its own permission set and edit any
// role's permissions, all DB-backed and taking effect without a restart
// (backend/src/common/permissions/role-permissions.ts's in-memory cache,
// written by backend/src/roles/roles.service.ts).
test.describe('Roles & Permissions admin', () => {
  test('Admin sees the "Roles & permissions" nav item', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/roles"]')).toBeVisible();
  });

  test('Director does not see the "Roles & permissions" nav item', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Director', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/roles"]')).toHaveCount(0);
  });

  test('Admin can create a custom role with a chosen permission set', async ({ page }) => {
    await login(page);
    await page.goto('/roles');
    await expect(page.locator('.panel-title', { hasText: 'Roles' })).toBeVisible();

    await page.locator('.btn-primary', { hasText: 'New role' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New role' })).toBeVisible();

    const roleId = `e2e_role_${Date.now()}`.slice(0, 40);
    const modal = page.locator('.modal');
    await modal.locator('#cr-id').fill(roleId);
    await modal.locator('#cr-label').fill('E2E Test Role');
    await modal.locator('label', { hasText: 'Portfolio dashboard' }).locator('input[type="checkbox"]').check();
    await modal.locator('label', { hasText: 'Cross-project & time-period analytics' }).locator('input[type="checkbox"]').check();
    await modal.locator('.modal-foot .btn-primary', { hasText: 'Create role' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New role' })).toHaveCount(0, { timeout: 10000 });

    // roleId (not the shared "E2E Test Role" label) is unique to this run —
    // the label alone can collide with leftover roles from prior runs.
    await expect(page.getByText(roleId)).toBeVisible();
  });

  test("Admin can edit an existing role's permissions and the change persists", async ({ page }) => {
    await login(page);
    await page.goto('/roles');

    // QA role starts without adminAnalytics — flip it on, save, then
    // reselect a different role and back to confirm the change persisted
    // server-side (not just local component state).
    await page.getByText('QA', { exact: true }).click();
    const analyticsCheckbox = page.locator('label', { hasText: 'Cross-project & time-period analytics' }).locator('input[type="checkbox"]');
    await expect(analyticsCheckbox).not.toBeChecked();
    await analyticsCheckbox.check();
    await page.locator('.btn-primary', { hasText: 'Save permissions' }).click();
    await expect(page.locator('.field-error')).toHaveCount(0);

    await page.reload();
    await page.getByText('QA', { exact: true }).click();
    await expect(page.locator('label', { hasText: 'Cross-project & time-period analytics' }).locator('input[type="checkbox"]')).toBeChecked();

    // Revert so this test is idempotent across reruns.
    await page.locator('label', { hasText: 'Cross-project & time-period analytics' }).locator('input[type="checkbox"]').uncheck();
    await page.locator('.btn-primary', { hasText: 'Save permissions' }).click();
  });
});
