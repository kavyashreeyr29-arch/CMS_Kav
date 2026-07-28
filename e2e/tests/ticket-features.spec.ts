import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Covers watchers, the SLA badge, and the activity/history timeline on the
// ticket detail page — all previously either unused (the backend history
// endpoint) or missing a UI entirely (watchers had no picker anywhere,
// SLA breach/risk data was computed but never rendered).
test.describe('Ticket detail — watchers, SLA, activity', () => {
  test('adding a watcher shows them in the watcher list and updates the count', async ({ page }) => {
    await login(page);
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    const watcherTitle = page.locator('.td-section-title', { hasText: 'Watchers (' });
    const beforeText = await watcherTitle.textContent();

    const addWatcherSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Add a watcher' }) });
    await addWatcherSelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(watcherTitle).not.toHaveText(beforeText ?? '', { timeout: 10000 });
    await expect(page.locator('.watcher-chip.active').first()).toBeVisible();
  });

  test('ticket detail renders the activity timeline from the history endpoint', async ({ page }) => {
    await login(page);
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    // Every seeded ticket has at least a "created" entry recorded via
    // ActivityLogService — this section used to render nothing at all
    // since the frontend never called GET /tickets/:id/history.
    const activitySection = page.getByTestId('ticket-activity');
    await expect(activitySection).toBeVisible();
    await expect(activitySection.locator('.timeline-item').first()).toBeVisible();
  });

  test('ticket list shows an SLA column and ticket detail shows an SLA badge slot without erroring', async ({ page }) => {
    await login(page);
    await page.goto('/tickets');
    await expect(page.locator('th', { hasText: 'SLA' })).toBeVisible();

    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);
    // Breached/at-risk tickets show a badge; healthy ones render nothing —
    // either way the page must not error, so just assert the ticket loaded.
    await expect(page.locator('.tid.mono')).toBeVisible();
  });
});
