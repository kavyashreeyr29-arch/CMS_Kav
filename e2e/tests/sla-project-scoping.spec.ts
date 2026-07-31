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
    // Options read "CODE — Name" (SlaPolicies.tsx); the code is what the
    // table's Project column actually renders, so anchor on that rather than
    // the resolution number below — repeat runs of this test (no cleanup
    // between runs) accumulate several org-wide "Low"/600m rows too, and a
    // resolution-only match can grab one of those instead of the row this
    // run created.
    const projectOptionText = await projectSelect.locator('option').nth(1).textContent();
    const projectCode = projectOptionText!.split('—')[0].trim();

    await page.locator('#sla-priority').selectOption('Low');
    await projectSelect.selectOption({ index: 1 });
    await page.locator('#sla-response').fill('45');
    await page.locator('#sla-resolution').fill('600');
    await page.locator('.btn-primary', { hasText: 'Add policy' }).click();

    const row = page.locator('table.data-table tbody tr', { hasText: 'Low' }).filter({ hasText: projectCode }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('td').nth(1)).not.toHaveText('All');
  });
});
