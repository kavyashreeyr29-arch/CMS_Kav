import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Covers the Projects create modal — previously a permanently-disabled
// button with no modal wired up at all.
test.describe('Projects', () => {
  test('creating a project via the New project modal navigates to its detail page', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.getByRole('button', { name: 'New project' }).click();
    await expect(page.locator('.modal-title')).toHaveText('New project');

    // Project.code is unique and capped at 10 chars in the UI (maxLength).
    // The *first* 10 chars of Date.now() barely change run-to-run (a 13-digit
    // ms timestamp's leading digits are stable for minutes), which collided
    // with a project created moments earlier in the same test session — use
    // the last, fast-moving digits instead.
    const code = `E2E${Date.now().toString().slice(-7)}`;
    await page.getByPlaceholder('e.g. Compass — Partner Onboarding').fill(`E2E Test Project ${Date.now()}`);
    await page.getByPlaceholder('e.g. COMPASS', { exact: true }).fill(code);
    await page.getByPlaceholder('Internal or client name').fill('E2E Test Client');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${code}$`), { timeout: 15000 });
    await expect(page.locator('.proj-code')).toHaveText(code);
  });
});
