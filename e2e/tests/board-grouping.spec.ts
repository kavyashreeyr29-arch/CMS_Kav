import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the multi-dimension board (CHANGELOG.md) — the single status
// Kanban gains a Group-by switcher (Status / Assignee / Priority / Type /
// Epic) turning it into swimlanes, so one board answers "where is everything",
// "who's loaded", "what's urgent", "what kind of work", and "which epic".
test.describe('Board grouping', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/kanban');
    await expect(page.locator('.board-toolbar')).toBeVisible();
  });

  test('defaults to Status columns and offers all five groupings', async ({ page }) => {
    await expect(page.locator('.board-toolbar .seg button.active')).toHaveText('Status');
    for (const g of ['Status', 'Assignee', 'Priority', 'Type', 'Epic']) {
      await expect(page.locator('.board-toolbar .seg button', { hasText: g })).toBeVisible();
    }
    // Status view uses the classic columns, not swimlanes.
    await expect(page.locator('.kanban .kcol').first()).toBeVisible();
    await expect(page.locator('.swimlane')).toHaveCount(0);
  });

  test('grouping by Assignee renders per-person swimlanes with counts', async ({ page }) => {
    await page.locator('.board-toolbar .seg button', { hasText: 'Assignee' }).click();
    await expect(page.locator('.swimlane').first()).toBeVisible();
    await expect(page.locator('.swimlane-head .swimlane-count').first()).toBeVisible();
  });

  test('grouping by Priority renders a swimlane per priority level', async ({ page }) => {
    await page.locator('.board-toolbar .seg button', { hasText: 'Priority' }).click();
    await expect(page.locator('.swimlane-head', { hasText: 'Critical' })).toBeVisible();
    await expect(page.locator('.swimlane-head', { hasText: 'Medium' })).toBeVisible();
  });

  test('grouping by Epic groups stories under their parent epic', async ({ page }) => {
    await page.locator('.board-toolbar .seg button', { hasText: 'Epic' }).click();
    await expect(page.locator('.swimlane').first()).toBeVisible();
  });
});
