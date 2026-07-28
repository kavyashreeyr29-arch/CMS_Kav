import { test, expect } from '@playwright/test';
import { login, SEED_ADMIN_EMAIL } from './fixtures';

test.describe('Authentication', () => {
  test('redirects an unauthenticated visitor to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('rejects a bad password with an inline error, no navigation', async ({ page }) => {
    // Deliberately not using the login() fixture — it waits for a
    // successful redirect, which never happens on this path.
    await page.goto('/login');
    await page.getByLabel('Email').fill(SEED_ADMIN_EMAIL);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs in with seeded credentials and lands on the Admin dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.kpi-label').getByText('Open tickets', { exact: true })).toBeVisible();
  });

  test('signing out returns to /login and blocks the dashboard again', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.locator('.role-switcher').click();
    await page.getByText('Sign out').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
