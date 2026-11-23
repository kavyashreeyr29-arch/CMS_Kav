import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for CHANGELOG.md's "project edit + SDLC stages" and "commercial
// documents" pass: ProjectDetail previously had no edit capability at all,
// ProjectStatus was Active/Planning/OnHold/Completed (not real SDLC phases),
// and there was no way to upload commercial docs (agreements/SOWs) separate
// from general project files.
test.describe('Project edit — SDLC stage', () => {
  test('Admin can edit a project\'s name, SDLC stage, priority, and dates, and it persists', async ({ page }) => {
    await login(page);
    await page.goto('/projects/ATLAS');
    await expect(page.locator('.proj-tab-bar')).toBeVisible();

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#pe-status')).toBeVisible();

    // SDLC phases are offered, not the old Active/Planning/OnHold/Completed set.
    const options = await page.locator('#pe-status option').allTextContents();
    expect(options).toEqual(expect.arrayContaining(['Planning', 'Requirement Analysis', 'Design', 'Implementation', 'Testing', 'Deployment', 'Maintenance', 'On Hold', 'Completed']));

    await page.locator('#pe-status').selectOption('Testing');
    await page.locator('#pe-priority').selectOption('Critical');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.locator('.proj-tab-bar')).toBeVisible(); // edit mode closed, overview visible again
    await expect(page.locator('.td-meta-item', { hasText: 'Stage' })).toContainText('Testing');

    await page.reload();
    await expect(page.locator('.td-meta-item', { hasText: 'Stage' })).toContainText('Testing');

    // Restore so this test is repeatable / doesn't leak into other specs.
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#pe-status').selectOption('Implementation');
    await page.locator('#pe-priority').selectOption('High');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.td-meta-item', { hasText: 'Stage' })).toContainText('Implementation');
  });

  test('Cancel discards changes without saving', async ({ page }) => {
    await login(page);
    await page.goto('/projects/ATLAS');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('#pe-status').selectOption('Maintenance');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.td-meta-item', { hasText: 'Stage' })).not.toContainText('Maintenance');
    await expect(page.locator('.td-meta-item', { hasText: 'Stage' })).toContainText('Implementation');
  });
});

test.describe('Project docs — commercial documents', () => {
  test('Uploading to the commercial section keeps it separate from general Document folder', async ({ page }) => {
    await login(page);
    await page.goto('/projects/ATLAS');
    await page.locator('.proj-tab-bar').getByText('Docs & Files').click();
    await expect(page.locator('.td-section-title', { hasText: 'Commercial documents' })).toBeVisible();

    const fileName = `e2e-agreement-${Date.now()}.txt`;
    await page.locator('input[type=file]').last().setInputFiles({
      name: fileName, mimeType: 'text/plain', buffer: Buffer.from('signed agreement contents'),
    });

    // Commercial section's grid is the *second* sibling after its title (the
    // first is the descriptive .panel-sub note); the general section's grid
    // is the immediate sibling.
    const commercialSection = page.locator('.td-section-title', { hasText: 'Commercial documents' }).locator('xpath=following-sibling::*[2]');
    await expect(commercialSection.locator('.att-card', { hasText: fileName })).toBeVisible({ timeout: 20000 });

    // Not duplicated into the general Document folder above it.
    const generalSection = page.locator('.td-section-title', { hasText: 'Document folder' }).locator('xpath=following-sibling::*[1]');
    await expect(generalSection.locator('.att-card', { hasText: fileName })).toHaveCount(0);
  });

  test('Every attachment card has a clearly labeled Download button', async ({ page }) => {
    await login(page);
    await page.goto('/projects/ATLAS');
    await page.locator('.proj-tab-bar').getByText('Docs & Files').click();
    await expect(page.locator('.att-card').first()).toBeVisible();
    await expect(page.locator('.att-download-btn').first()).toHaveText(/Download/);
  });
});
