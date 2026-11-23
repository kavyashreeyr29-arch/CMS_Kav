import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the Basecamp-style project restructure documented in
// CHANGELOG.md — ProjectDetail.tsx split into tabs (Overview, Docs & Files,
// Campaigns, Communication, Rewards, To-do list), with Tickets jumping to
// the real Tickets page pre-filtered instead of a duplicate embedded list.
test.describe('Project detail — Basecamp-style folders', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Seeded ATLAS project, not `.proj-card.first()` — the Projects list is
    // ordered by createdAt desc, so "first" is whatever project another test
    // most recently created and may have zero tickets, breaking the
    // ticket-linking tests below.
    await page.goto('/projects/ATLAS');
    await expect(page.locator('.proj-tab-bar')).toBeVisible();
  });

  test('Total tickets stat and the Tickets folder both jump to the pre-filtered Tickets page', async ({ page }) => {
    await page.locator('.proj-stat-actionable', { hasText: 'Total tickets' }).click();
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.locator('.proj-select')).not.toHaveValue('ALL');
  });

  test('Campaigns tab: create a campaign, link a ticket, and upload a campaign file', async ({ page }) => {
    await page.locator('.proj-tab-bar').getByText('Campaigns').click();
    await page.getByRole('button', { name: 'New campaign' }).click();
    const name = `E2E Campaign ${Date.now()}`;
    await page.locator('#camp-name').fill(name);
    await page.getByRole('button', { name: 'Create campaign' }).click();
    await expect(page.locator('.folder-card-title', { hasText: name })).toBeVisible();

    await page.locator('.folder-card', { hasText: name }).click();
    const linkSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Link an existing ticket' }) });
    await linkSelect.waitFor();
    await linkSelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Link' }).click();
    await expect(page.locator('.timeline-item')).toBeVisible();

    const fileName = `e2e-campaign-file-${Date.now()}.txt`;
    await page.locator('input[type=file]').setInputFiles({ name: fileName, mimeType: 'text/plain', buffer: Buffer.from('campaign file') });
    await expect(page.locator('.att-card', { hasText: fileName })).toBeVisible({ timeout: 20000 });
  });

  test('Rewards tab: create a reward with type/value', async ({ page }) => {
    await page.locator('.proj-tab-bar').getByText('Rewards').click();
    await page.getByRole('button', { name: 'New reward' }).click();
    const name = `E2E Reward ${Date.now()}`;
    await page.locator('#rwd-name').fill(name);
    await page.locator('#rwd-type').fill('Points');
    await page.locator('#rwd-value').fill('500');
    await page.getByRole('button', { name: 'Create reward' }).click();
    await expect(page.locator('.folder-card-title', { hasText: name })).toBeVisible();
    await expect(page.locator('.folder-card', { hasText: name })).toContainText('Points');
  });

  test('Communication tab: post an update, see it listed, and delete it', async ({ page }) => {
    await page.locator('.proj-tab-bar').getByText('Communication').click();
    const body = `E2E update ${Date.now()}`;
    await page.locator('textarea[placeholder*="Post an update"]').fill(body);
    // exact: true — ATLAS has seeded notes with "Delete post" buttons, whose
    // accessible name otherwise substring-matches "Post" too.
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.locator('.note-item', { hasText: body })).toBeVisible();

    await page.locator('.note-item', { hasText: body }).locator('.icon-btn').click();
    await expect(page.locator('.note-item', { hasText: body })).toHaveCount(0);
  });

  test('To-do tab: add a to-do, mark it done, then delete it', async ({ page }) => {
    await page.locator('.proj-tab-bar').getByText('To-do list').click();
    const title = `E2E todo ${Date.now()}`;
    await page.locator('input[placeholder="Add a to-do…"]').fill(title);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const row = page.locator('.todo-row', { hasText: title });
    await expect(row).toBeVisible();

    await row.locator('input[type="checkbox"]').click();
    await expect(page.locator('.todo-row.done', { hasText: title })).toBeVisible();

    await row.locator('.icon-btn').click();
    await expect(page.locator('.todo-row', { hasText: title })).toHaveCount(0);
  });

  test('Docs & Files tab is no longer shown on the default Overview tab', async ({ page }) => {
    await expect(page.locator('.td-section-title', { hasText: 'Document folder' })).toHaveCount(0);
    await page.locator('.proj-tab-bar').getByText('Docs & Files').click();
    await expect(page.locator('.td-section-title', { hasText: 'Document folder' })).toBeVisible();
  });
});
