import { Page, test, expect } from '@playwright/test';
import { login } from './fixtures';

// Locates the <select>/<input> inside the `.field` block for a given label
// text, rather than a positional nth() index — field order in
// CreateTicketModal.tsx can shift (e.g. "Parent Epic" only appears for
// Story), so index-based selectors would be fragile.
function fieldControl(page: Page, labelText: string) {
  return page.locator(`.modal .field:has(label:text-is("${labelText}")) select, .modal .field:has(label:text-is("${labelText}")) input`);
}

async function openNewTicketModal(page: Page) {
  await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
  await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
  // Project options populate async (projectsApi.list() on modal mount) —
  // wait for them before touching any field, or selectOption() races ahead
  // of the list and finds nothing to select.
  await expect(fieldControl(page, 'Project').locator('option').first()).toBeAttached();
}

async function submitNewTicket(page: Page) {
  await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
  await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });
}

// Coverage for the "PRD Phase 2a" batch documented in CHANGELOG.md — global
// search, attachments staged at ticket-creation time, Epic/Story linkage,
// and timer second-level precision.
test.describe('Phase 2a — foundational fixes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Global search finds a seeded ticket and navigates to its detail page', async ({ page }) => {
    const input = page.locator('.search-box input');
    await input.fill('Login fails');
    const dropdown = page.locator('.search-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText('Tickets', { exact: true })).toBeVisible();
    const firstResult = dropdown.locator('.search-result-item').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();
    await expect(page).toHaveURL(/\/tickets\/.+/);
  });

  test('New ticket modal accepts an attachment and it shows up on the created ticket', async ({ page }) => {
    await openNewTicketModal(page);
    await fieldControl(page, 'Title').fill(`E2E attach test ${Date.now()}`);

    const fileName = `e2e-create-${Date.now()}.txt`;
    await page.locator('.modal input[type=file]').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('staged at creation time'),
    });
    await expect(page.locator('.modal').getByText(fileName)).toBeVisible({ timeout: 20000 });

    await submitNewTicket(page);
    await expect(page.locator('.att-card', { hasText: fileName })).toBeVisible({ timeout: 20000 });
  });

  test('Creating a Story under a new Epic links them, and Backlog groups the Story under it', async ({ page }) => {
    const epicTitle = `E2E Epic ${Date.now()}`;

    await openNewTicketModal(page);
    const projectCode = await fieldControl(page, 'Project').inputValue();
    await fieldControl(page, 'Title').fill(epicTitle);
    await fieldControl(page, 'Type').selectOption('Epic');
    await submitNewTicket(page);

    const storyTitle = `E2E Story ${Date.now()}`;
    await openNewTicketModal(page);
    await fieldControl(page, 'Project').selectOption(projectCode);
    await fieldControl(page, 'Title').fill(storyTitle);
    await fieldControl(page, 'Type').selectOption('Story');
    const parentEpicSelect = fieldControl(page, 'Parent Epic');
    await expect(parentEpicSelect).toBeVisible();
    const epicOption = parentEpicSelect.locator('option', { hasText: epicTitle });
    await expect(epicOption).toBeAttached();
    const epicValue = await epicOption.getAttribute('value');
    await parentEpicSelect.selectOption(epicValue!);
    await submitNewTicket(page);
    await expect(page.getByText('Part of:', { exact: false })).toBeVisible();

    await page.locator('.sidebar-nav a[href="/backlog"]').click();
    await expect(page).toHaveURL(/\/backlog$/);
    await page.locator('.filter-bar select').first().selectOption(projectCode);
    await expect(page.getByText(epicTitle)).toBeVisible();
    await expect(page.getByText(storyTitle)).toBeVisible();
  });

  test('A short timer run on a ticket shows a sub-minute duration instead of 0m', async ({ page }) => {
    await page.goto('/tickets');
    await page.locator('table.data-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/tickets\/.+/);

    const startBtn = page.locator('.timer-btn', { hasText: 'Start timer' });
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(2000);
      await page.locator('.timer-btn', { hasText: 'Stop timer' }).click();
      const loggedRow = page.locator('.timeline-item', { hasText: 'logged' }).first();
      await expect(loggedRow).toBeVisible();
      await expect(loggedRow).not.toContainText('logged 0m');
    }
  });
});
