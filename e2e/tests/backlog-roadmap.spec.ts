import { Page, test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the Backlog → Jira-style roadmap upgrade documented in
// CHANGELOG.md — a display-only "stage" (Planning/Development/Testing/
// Deployed) derived from existing type+status, a project-wide stage-count
// summary, and per-Epic completion progress (X/Y stories done).
function fieldControl(page: Page, labelText: string) {
  return page.locator(`.modal .field:has(label:text-is("${labelText}")) select, .modal .field:has(label:text-is("${labelText}")) input`);
}

async function createTicket(page: Page, projectCode: string, title: string, type: string, parentEpicTitle?: string) {
  await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
  await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();
  // Project options populate async — wait for the specific option this test
  // needs, not just "any option", or selectOption can race ahead of the
  // fetch and find nothing matching yet.
  await expect(fieldControl(page, 'Project').locator(`option[value="${projectCode}"]`)).toBeAttached();
  await fieldControl(page, 'Project').selectOption(projectCode);
  await fieldControl(page, 'Title').fill(title);
  await fieldControl(page, 'Type').selectOption(type);
  if (parentEpicTitle) {
    const parentEpicSelect = fieldControl(page, 'Parent Epic');
    await expect(parentEpicSelect).toBeVisible();
    const epicOption = parentEpicSelect.locator('option', { hasText: parentEpicTitle });
    await expect(epicOption).toBeAttached();
    const epicValue = await epicOption.getAttribute('value');
    await parentEpicSelect.selectOption(epicValue!);
  }
  await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
  await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });
}

test.describe('Backlog roadmap (Jira-style stage tracking)', () => {
  test('Backlog explains what it shows (Epics/Stories, drag order, stage tracking)', async ({ page }) => {
    await login(page);
    await page.goto('/backlog');
    await expect(page.getByText('planning view for this project', { exact: false })).toBeVisible();
    await expect(page.getByText('Planning → Development → Testing → Deployed', { exact: false })).toBeVisible();
  });

  test('Roadmap summary shows stage counts, and an Epic with a Story shows a completion progress bar and stage chip', async ({ page }) => {
    await login(page);
    await page.goto('/backlog');
    const projectSelect = page.locator('.filter-bar select').first();
    // Projects populate async — wait for a real option before reading the
    // select's value, or inputValue() can race ahead of the fetch and
    // return "".
    await expect(projectSelect.locator('option').first()).toBeAttached();
    const projectCode = await projectSelect.inputValue();
    expect(projectCode).not.toBe('');

    const epicTitle = `E2E Roadmap Epic ${Date.now()}`;
    await createTicket(page, projectCode, epicTitle, 'Epic');
    const storyTitle = `E2E Roadmap Story ${Date.now()}`;
    await createTicket(page, projectCode, storyTitle, 'Story', epicTitle);

    await page.locator('.sidebar-nav a[href="/backlog"]').click();
    await expect(page).toHaveURL(/\/backlog$/);
    await page.locator('.filter-bar select').first().selectOption(projectCode);

    await expect(page.locator('.panel-title', { hasText: 'Roadmap — requirement to deployment' })).toBeVisible();
    for (const stage of ['Planning', 'Development', 'Testing', 'Deployed']) {
      await expect(page.locator('.mom-label', { hasText: stage })).toBeVisible();
    }

    const epicBlock = page.locator('.td-section-title', { hasText: epicTitle }).locator('..');
    await expect(epicBlock.getByText('0/1 done')).toBeVisible();
    await expect(epicBlock.getByText('1 Planning')).toBeVisible();
  });
});
