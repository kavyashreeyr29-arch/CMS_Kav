import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the "PRD Phase 2e" batch documented in CHANGELOG.md —
// project-level access control, SLA policy document upload + bulk CSV
// import, and the QA testing module.
test.describe('Phase 2e — access control, SLA docs, QA module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('Creating a project with a restricted member list shows a Manage access section on its detail page', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('.btn-primary', { hasText: 'New project' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New project' })).toBeVisible();

    const code = `E2EACC${Date.now().toString().slice(-4)}`;
    await page.locator('.modal input[placeholder*="Compass"]').fill(`E2E Access Test ${code}`);
    await page.locator('.modal input[placeholder*="COMPASS"]').fill(code);
    await page.locator('.modal input[placeholder="Internal or client name"]').fill('Internal');
    await expect(page.locator('.modal .watcher-chip').first()).toBeVisible();
    await page.locator('.modal .watcher-chip').first().click();

    await page.locator('.modal-foot .btn-primary', { hasText: 'Create project' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${code}`), { timeout: 15000 });
    await expect(page.locator('.td-section-title', { hasText: 'Access (' })).toContainText('Access (1)');
  });

  test('Attaching a document to an SLA policy shows it as a downloadable chip', async ({ page }) => {
    await page.goto('/sla-policies');
    await expect(page.locator('.panel-title', { hasText: 'SLA policies' })).toBeVisible();
    // Pick whichever row doesn't already have a document — earlier tests /
    // manual verification in this session may have attached one already.
    const attachInput = page.locator('table.data-table tbody tr label', { hasText: 'Attach' }).first().locator('input[type=file]');
    await expect(attachInput).toBeAttached();

    const fileName = `e2e-sla-doc-${Date.now()}.txt`;
    await attachInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('sla agreement text'),
    });
    // The backend has no explicit sort key other than createdAt, so which
    // row ends up showing the new document isn't asserted — just that it
    // shows up as a downloadable chip somewhere in the table.
    await expect(page.locator('table.data-table').getByText(fileName)).toBeVisible({ timeout: 20000 });
  });

  test('SLA bulk CSV import shows a validation preview before committing', async ({ page }) => {
    await page.goto('/sla-policies');
    await page.locator('.panel-head .btn-ghost', { hasText: 'Import CSV' }).click();
    await expect(page.locator('.modal-title', { hasText: 'Import SLA policies' })).toBeVisible();

    const csv = 'priority,project,client,responseTarget,resolutionTarget\nHigh,,,30,180\nBogus,,,,';
    await page.locator('.modal input[type=file]').setInputFiles({
      name: 'policies.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByText('1 of 2 rows valid')).toBeVisible({ timeout: 10000 });
    await page.locator('.modal-foot .btn-primary', { hasText: 'Import 1 policy' }).click();
    await expect(page.locator('.modal-title', { hasText: 'Import SLA policies' })).not.toBeVisible({ timeout: 10000 });
  });

  test('Adding and passing a QA test case on a ticket shows it in the list', async ({ page }) => {
    // Use a freshly created ticket rather than "whatever's first in the
    // table" — the tickets list is shared, mutable state that other e2e
    // tests (and ad-hoc runs) also create tickets into, so picking the first
    // row is not isolated and can pick up leftover test cases from unrelated
    // runs, making the "X/X passing" assertion below unreliable.
    await page.goto('/tickets');
    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(`E2E QA test case ticket ${Date.now()}`);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });

    await expect(page.locator('.td-section-title', { hasText: 'QA testing' })).toBeVisible();
    await page.locator('.btn-ghost', { hasText: 'Add test case' }).click();

    const title = `E2E test case ${Date.now()}`;
    await page.locator('.ticket-detail-main input[placeholder*="Login with valid"]').fill(title);
    await page.locator('.btn-primary', { hasText: 'Add test case' }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    const caseRow = page.locator('.timeline-item', { hasText: title });
    await caseRow.locator('select').selectOption('pass');
    // Don't assume this is the only test case on the ticket — just assert
    // pass count now equals total count (X/X passing).
    const sectionTitle = page.locator('.td-section-title', { hasText: 'QA testing' });
    await expect(sectionTitle).toContainText(/(\d+)\/\1 passing/, { timeout: 10000 });
  });
});
