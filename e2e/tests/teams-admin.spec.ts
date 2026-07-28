import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the Teams admin UI (CHANGELOG.md "admin should be able to
// create teams") — Team already drove the 'team' permission scope
// end-to-end, but there was no admin UI to create or edit one until now.
test.describe('Teams admin', () => {
  test('Admin sees the Teams nav item', async ({ page }) => {
    await login(page);
    await expect(page.locator('.sidebar-nav a[href="/teams"]')).toBeVisible();
  });

  test('Director does not see the Teams nav item', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Director', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/teams"]')).toHaveCount(0);
  });

  test('Admin can create a team with a lead and members, then edit it', async ({ page }) => {
    await login(page);
    await page.goto('/teams');
    await expect(page.locator('.filter-bar')).toBeVisible();

    const teamName = `E2E Team ${Date.now()}`;
    await page.locator('.btn-primary', { hasText: 'New team' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New team' })).toBeVisible();

    const modal = page.locator('.modal');
    await modal.locator('#team-name').fill(teamName);
    await expect(modal.locator('#team-lead option').nth(1)).toBeAttached();
    await modal.locator('#team-lead').selectOption({ index: 1 });
    await modal.locator('.watcher-chip').first().click();
    await modal.locator('.modal-foot .btn-primary', { hasText: 'Create team' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New team' })).toHaveCount(0, { timeout: 10000 });

    const card = page.locator('.panel', { hasText: teamName });
    await expect(card).toBeVisible();
    await expect(card.getByText('1 member')).toBeVisible();

    // Edit: rename it.
    await card.click();
    await expect(page.locator('.modal-title', { hasText: `Edit ${teamName}` })).toBeVisible();
    const renamed = `${teamName} Renamed`;
    await page.locator('.modal #team-name').fill(renamed);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Save changes' }).click();
    await expect(page.getByText(renamed)).toBeVisible({ timeout: 10000 });
  });
});
