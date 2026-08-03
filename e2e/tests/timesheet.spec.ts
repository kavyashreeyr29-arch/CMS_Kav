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

  test('team-summary is org-wide for a director (no timeTracking) but forbidden for an individual-visibility role', async ({ request }) => {
    const dirT = await token(request, DIRECTOR_EMAIL);
    const summary = await request.get(`${API_BASE}/time-entries/team-summary?startDate=2026-06-01&endDate=2026-08-03`, { headers: auth(dirT) });
    expect(summary.ok()).toBeTruthy();
    const rows = await summary.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('automated_minutes');
    expect(rows[0]).toHaveProperty('manual_minutes');

    const devT = await token(request, DEVELOPER_EMAIL);
    const forbidden = await request.get(`${API_BASE}/time-entries/team-summary?startDate=2026-06-01&endDate=2026-08-03`, { headers: auth(devT) });
    expect(forbidden.status()).toBe(403);
  });

  test('a director can drill into a specific person via ?userId=, an individual-visibility role cannot', async ({ request }) => {
    const dirT = await token(request, DIRECTOR_EMAIL);
    const devLogin = await (await request.post(`${API_BASE}/auth/login`, { data: { email: DEVELOPER_EMAIL, password: 'password123' } })).json();

    const asDirector = await request.get(
      `${API_BASE}/time-entries/mine?startDate=2026-08-01&endDate=2026-08-03&userId=${devLogin.user.id}`,
      { headers: auth(dirT) },
    );
    expect(asDirector.ok()).toBeTruthy();

    const otherDevT = await token(request, 'jortiz@elevatohub.io');
    const asPeer = await request.get(
      `${API_BASE}/time-entries/mine?startDate=2026-08-01&endDate=2026-08-03&userId=${devLogin.user.id}`,
      { headers: auth(otherDevT) },
    );
    expect(asPeer.status()).toBe(403);
  });
});

test.describe('My Timesheet — UI', () => {
  test('nav item is visible both for a time-tracking role (individual view) and an org-visibility role with no timeTracking (team view)', async ({ page }) => {
    await login(page, DEVELOPER_EMAIL);
    await expect(page.locator('.nav-item', { hasText: 'My Timesheet' })).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await login(page, DIRECTOR_EMAIL);
    await expect(page.locator('.nav-item', { hasText: 'My Timesheet' })).toBeVisible();

    // ...but hidden for a role with neither timeTracking nor org/team work-hours visibility.
    await page.evaluate(() => localStorage.clear());
    await login(page, 'rgupta@elevatohub.io');
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

  test('a director lands on the Team overview by default, and drilling into a person shows a read-only view', async ({ page }) => {
    await login(page, DIRECTOR_EMAIL);
    await page.goto('/timesheet');
    const teamPanel = page.getByTestId('timesheet-team-summary');
    await expect(teamPanel).toBeVisible();
    await expect(teamPanel.locator('table.data-table tbody tr').first()).toBeVisible();
    // A whole-team KPI summary (Automated/Manual/Total/People) sits above the table.
    await expect(page.locator('.kpi-grid .kpi-label', { hasText: 'Automated' })).toBeVisible();
    await expect(page.locator('.kpi-grid .kpi-label', { hasText: 'Manual' })).toBeVisible();
    await expect(page.locator('.kpi-grid .kpi-label', { hasText: 'People with time logged' })).toBeVisible();
    // No individual "Add entry" workflow visible on the team overview itself.
    await expect(page.getByRole('button', { name: 'Add entry' })).toHaveCount(0);

    await teamPanel.locator('table.data-table tbody tr.clickable').first().click();
    await expect(page.getByTestId('timesheet-team-summary')).toHaveCount(0);
    await expect(page.getByTestId('timesheet-automated')).toBeVisible();
    // Viewing someone else — read-only: no way to add or delete a manual entry.
    await expect(page.getByRole('button', { name: 'Add entry' })).toHaveCount(0);
    await expect(page.getByTestId('timesheet-manual').locator('.icon-btn')).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to team overview' }).click();
    await expect(page.getByTestId('timesheet-team-summary')).toBeVisible();
  });
});
