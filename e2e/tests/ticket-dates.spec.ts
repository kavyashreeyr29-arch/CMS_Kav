import { test, expect, Page } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the ticket date-field additions documented in CHANGELOG.md:
// Created/Last modified/Started(actual timer start)/Closed on ticket detail.
//
// Scoped by .td-meta-label text, not the whole .td-meta-item's text — the
// Status field is a <select> whose options include the literal word
// "Closed", so a loose hasText match on the item ambiguously matches both.
function metaItem(page: Page, label: string) {
  return page.locator('.td-meta-item').filter({ has: page.locator('.td-meta-label', { hasText: label }) });
}

test.describe('Ticket detail — date fields', () => {
  test('shows Created, Last modified, Started, and Closed fields', async ({ page }) => {
    await login(page);
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    await expect(metaItem(page, 'Created')).toBeVisible();
    await expect(metaItem(page, 'Last modified')).toBeVisible();
    await expect(metaItem(page, 'Started')).toBeVisible();
    await expect(metaItem(page, 'Closed')).toBeVisible();
  });

  test('Started shows "Not started" before a timer runs, and a date once one starts', async ({ page }) => {
    await login(page);
    await page.goto('/tickets');
    const title = `E2E started-date ticket ${Date.now()}`;
    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(title);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });

    await expect(metaItem(page, 'Started')).toContainText('Not started');

    await page.getByRole('button', { name: /start timer/i }).click();
    await page.getByRole('button', { name: /stop timer/i }).click({ timeout: 10000 });
    await expect(metaItem(page, 'Started')).not.toContainText('Not started');
  });

  test('Closed shows a date once the ticket is moved to Closed, and clears on reopen', async ({ page }) => {
    await login(page);
    await page.goto('/tickets');
    const title = `E2E closed-date ticket ${Date.now()}`;
    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(title);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });

    await expect(metaItem(page, 'Closed')).toContainText('—');

    await page.locator('#td-status').selectOption('Closed');
    await expect(metaItem(page, 'Closed')).not.toContainText('—');

    await page.getByRole('button', { name: /reopen ticket/i }).click();
    await expect(metaItem(page, 'Closed')).toContainText('—');
  });
});
