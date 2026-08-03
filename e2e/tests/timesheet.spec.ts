import { test, expect, APIRequestContext } from '@playwright/test';
import { login } from './fixtures';

// Coverage for "My Timesheet" (CHANGELOG.md) — an automated view grouping
// ticket-timer entries by ticket (start/end date, total time, day-by-day),
// plus a manual-entry form/list for time logged without the timer running.
// Distinct from /work-hours (the manager/lead rollup across other people).
const API_BASE = 'http://localhost:3000/api/v1';
const DEVELOPER_EMAIL = 'psharma@elevatohub.io'; // senior_developer — timeTracking: true
const DIRECTOR_EMAIL = 'nrao@elevatohub.io'; // director — timeTracking: false

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

test.describe('My Timesheet — API', () => {
  test('a role without timeTracking is forbidden from every timesheet endpoint', async ({ request }) => {
    const t = await token(request, DIRECTOR_EMAIL);
    const list = await request.get(`${API_BASE}/time-entries/mine?startDate=2026-08-01&endDate=2026-08-03`, { headers: auth(t) });
    expect(list.status()).toBe(403);
    const create = await request.post(`${API_BASE}/time-entries`, {
      headers: auth(t), data: { date: '2026-08-03', fromTime: '09:00', toTime: '10:00', taskName: 'nope' },
    });
    expect(create.status()).toBe(403);
  });

  test('a manual entry requires toTime after fromTime', async ({ request }) => {
    const t = await token(request, DEVELOPER_EMAIL);
    const res = await request.post(`${API_BASE}/time-entries`, {
      headers: auth(t), data: { date: '2026-08-03', fromTime: '14:00', toTime: '13:00', taskName: 'bad range' },
    });
    expect(res.status()).toBe(400);
  });

  test('creating a manual entry computes duration, and only its own creator can delete it', async ({ request }) => {
    const t = await token(request, DEVELOPER_EMAIL);
    const otherT = await token(request, 'jortiz@elevatohub.io');
    const created = await request.post(`${API_BASE}/time-entries`, {
      headers: auth(t), data: { date: '2026-08-03', fromTime: '09:00', toTime: '10:30', taskName: `E2E API manual ${Date.now()}` },
    });
    expect(created.ok()).toBeTruthy();
    const entry = await created.json();
    expect(entry.durationMinutes).toBe('90');
    expect(entry.source).toBe('manual');

    const forbiddenDelete = await request.delete(`${API_BASE}/time-entries/${entry.id}`, { headers: auth(otherT) });
    expect(forbiddenDelete.status()).toBe(403);

    const ownDelete = await request.delete(`${API_BASE}/time-entries/${entry.id}`, { headers: auth(t) });
    expect(ownDelete.ok()).toBeTruthy();
  });

  test('a timer-derived entry cannot be deleted through the manual-delete endpoint', async ({ request }) => {
    const t = await token(request, DEVELOPER_EMAIL);
    const mine = await (await request.get(`${API_BASE}/time-entries/mine?startDate=2026-08-01&endDate=2026-08-03`, { headers: auth(t) })).json();
    const timerEntry = mine.find((e: { source: string }) => e.source === 'timer');
    const res = await request.delete(`${API_BASE}/time-entries/${timerEntry.id}`, { headers: auth(t) });
    expect(res.status()).toBe(400);
  });
});

test.describe('My Timesheet — UI', () => {
  test('nav item is visible for a time-tracking role and hidden for one that is not', async ({ page }) => {
    await login(page, DEVELOPER_EMAIL);
    await expect(page.locator('.nav-item', { hasText: 'My Timesheet' })).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await login(page, DIRECTOR_EMAIL);
    await expect(page.locator('.nav-item', { hasText: 'My Timesheet' })).toHaveCount(0);
  });

  test('automated section groups timer entries by ticket with a day-by-day breakdown on click', async ({ page }) => {
    await login(page, DEVELOPER_EMAIL);
    await page.goto('/timesheet');
    const panel = page.getByTestId('timesheet-automated');
    await expect(panel.locator('table.data-table tbody tr').first()).toBeVisible();

    const firstRow = panel.locator('table.data-table tbody tr.clickable').first();
    await expect(panel.locator('.label-chip')).toHaveCount(0);
    await firstRow.click();
    await expect(panel.locator('.label-chip').first()).toBeVisible();
  });

  test('manual entry: create it, see it in the list and totals, then delete it', async ({ page }) => {
    await login(page, DEVELOPER_EMAIL);
    await page.goto('/timesheet');
    const panel = page.getByTestId('timesheet-manual');
    const taskName = `E2E UI manual ${Date.now()}`;

    await panel.getByRole('button', { name: 'Add entry' }).click();
    await page.locator('#ts-task').fill(taskName);
    await page.locator('#ts-from').fill('09:00');
    await page.locator('#ts-to').fill('10:00');
    await panel.getByRole('button', { name: 'Save entry' }).click();

    const row = panel.locator('tr', { hasText: taskName });
    await expect(row).toBeVisible();
    await expect(row.locator('td').nth(5)).toHaveText('1h 0m');

    await row.locator('.icon-btn').click();
    await expect(page.locator('tr', { hasText: taskName })).toHaveCount(0);
  });

  test('manual entry form rejects an end time before the start time', async ({ page }) => {
    await login(page, DEVELOPER_EMAIL);
    await page.goto('/timesheet');
    const panel = page.getByTestId('timesheet-manual');
    await panel.getByRole('button', { name: 'Add entry' }).click();
    await page.locator('#ts-task').fill('bad range via UI');
    await page.locator('#ts-from').fill('14:00');
    await page.locator('#ts-to').fill('13:00');
    await panel.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.locator('.field-error')).toBeVisible();
  });
});
