import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the SLA per-project scoping UI (CHANGELOG.md) — the backend
// always supported a project-specific SLA policy (Prisma SlaPolicy.projectId)
// but the create form never exposed a project picker, so it was only
// reachable via the CSV bulk-upload path. Now a real field on the form.
test.describe('SLA policies — per-project scoping', () => {
  test('Creating a policy with a specific project shows that project in the table, not "All"', async ({ page }) => {
    await login(page);
    await page.goto('/sla-policies');
    await expect(page.locator('.panel-title', { hasText: 'SLA policies' })).toBeVisible();

    const projectSelect = page.locator('#sla-project');
    await expect(projectSelect.locator('option').nth(1)).toBeAttached();

    await page.locator('#sla-priority').selectOption('Low');
    await projectSelect.selectOption({ index: 1 });
    await page.locator('#sla-response').fill('45');
    await page.locator('#sla-resolution').fill('600');
    await page.locator('.btn-primary', { hasText: 'Add policy' }).click();

    // Seed data already has an org-wide "Low" policy — match on the
    // distinctive resolution target (600m) this test just set, not just
    // "Low", or `.first()` could grab the pre-existing org-wide row instead.
    const row = page.locator('table.data-table tbody tr', { hasText: 'Low' }).filter({ hasText: '600m' }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('td').nth(1)).not.toHaveText('All');
  });
});
