import { test, expect } from '@playwright/test';

// Covers the TEMPORARY test-only quick-login panel on the Login page
// (frontend/src/pages/Login.tsx + demoAccounts.ts). Delete this spec file
// alongside that panel — see CLAUDE.md / CHANGELOG.md 2026-07-22.
test.describe('Quick login (test-only panel)', () => {
  test('lists all 12 seeded roles grouped by access level', async ({ page }) => {
    await page.goto('/login');
    const panel = page.locator('.panel', { hasText: 'Quick login' });
    await expect(panel.getByRole('button', { name: 'Admin' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Lead' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Junior Developer' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Intern' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'QA' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Call Center Agent' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Client' })).toBeVisible();
  });

  test('Lead quick-login lands on the team-scoped dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Lead' }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.kpi-label').getByText('Open tickets', { exact: true })).toBeVisible();
  });

  test('Client quick-login lands on the reporter-scoped ticket view', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.waitForURL(/\/tickets$/);
    await expect(page.getByText(/you're viewing only tickets you raised/i)).toBeVisible();
  });

  test('Call Center Agent quick-login lands on their personal summary', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Call Center Agent' }).click();
    await page.waitForURL(/\/my-board$/);
    await expect(page.getByText('Raised by me')).toBeVisible();
  });
});
