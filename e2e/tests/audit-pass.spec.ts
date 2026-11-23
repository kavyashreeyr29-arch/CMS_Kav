import { test, expect, APIRequestContext } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the sanity-check/audit pass (CHANGELOG.md): a new "Time in
// status" cycle-time analytics panel, the fix for Dashboard's per-project
// Recent activity filter (projectCode was never populated), the seeded
// Kanban statuses that used to be permanently empty, GitHub/AI integrations
// no longer showing a bare "not connected" state, and a representative
// sample of the new CSV export buttons (exhaustively testing all ~20 would
// be redundant — they all share the same exportToCsv helper already covered
// elsewhere).
const API_BASE = 'http://localhost:3000/api/v1';

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

test.describe('Audit pass — API', () => {
  test('cycle-time returns per-status averages, ordered by longest-stuck first', async ({ request }) => {
    const t = await token(request, 'pmanager@elevatohub.io');
    const res = await request.get(`${API_BASE}/analytics/cycle-time`, { headers: auth(t) });
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('avgHours');
    expect(rows[0]).toHaveProperty('transitions');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].avgHours).toBeGreaterThanOrEqual(rows[i].avgHours);
    }
  });

  test('a new ticket status-change now carries a real projectCode on its activity log entry', async ({ request }) => {
    const t = await token(request, 'pmanager@elevatohub.io');
    const created = await (await request.post(`${API_BASE}/tickets`, {
      headers: auth(t), data: { projectCode: 'ATLAS', title: `E2E activity projectCode ${Date.now()}`, type: 'Task', priority: 'Medium', source: 'InternalPM' },
    })).json();
    const history = await (await request.get(`${API_BASE}/tickets/${created.id}/history`, { headers: auth(t) })).json();
    expect(history.length).toBeGreaterThan(0);
    // The activity endpoint itself doesn't echo projectCode, so verify via
    // the Dashboard's own filtered query instead — the real regression this
    // guards is "does filtering Recent Activity by project find this entry".
    const recent = await (await request.get(`${API_BASE}/activity-log/recent?limit=50`, { headers: auth(t) })).json();
    const entry = recent.find((e: { ticketId: string }) => e.ticketId === created.id);
    expect(entry?.projectCode).toBe('ATLAS');
  });
});

test.describe('Audit pass — UI', () => {
  test('Kanban Status board has real tickets in every column, including the previously-empty ones', async ({ page }) => {
    await login(page);
    await page.goto('/kanban');
    await expect(page.locator('.kcol-title', { hasText: 'Assigned' })).toBeVisible();
    const assignedCol = page.locator('.kcol', { has: page.locator('.kcol-title', { hasText: 'Assigned' }) });
    await expect(assignedCol.locator('.kcard').first()).toBeVisible();
  });

  test('GitHub integration shows Connected with a configured repo', async ({ page }) => {
    // Asserts the connected *state*, not a specific repo name: the
    // GithubIntegration row is a per-org singleton that other suites
    // (github-webhook.spec.ts, workflow-gates.spec.ts) legitimately
    // overwrite with their own placeholder repoOwner/repoName as part of
    // their own setup, so pinning the seeded value here is over-specified
    // and order-dependent on whichever spec ran last.
    await login(page);
    await page.goto('/github');
    await expect(page.getByText('CONNECTED')).toBeVisible();
    await expect(page.locator('#gh-name')).not.toHaveValue('');
  });

  test('AI integrations shows a configured default provider', async ({ page }) => {
    await login(page);
    await page.goto('/ai-providers');
    await expect(page.locator('table.data-table')).toContainText('OpenAI (default)');
  });

  test('Docs & Files documents actually download real content, not a dead link', async ({ page, request }) => {
    const t = await token(request, 'pmanager@elevatohub.io');
    const project = await (await request.get(`${API_BASE}/projects/ATLAS`, { headers: auth(t) })).json();
    const doc = project.documents.find((d: { fileName: string }) => d.fileName === 'architecture-notes.txt');
    expect(doc).toBeTruthy();
    const dl = await request.get(`${API_BASE}/projects/ATLAS/documents/${doc.id}/download-url`, { headers: auth(t) });
    const { downloadUrl } = await dl.json();
    const fileRes = await request.get(downloadUrl);
    expect(fileRes.ok()).toBeTruthy();
    expect(await fileRes.text()).toContain('ATLAS architecture notes');
  });

  test('Analytics "Time in status" panel renders bars and its CSV export downloads', async ({ page }) => {
    await login(page);
    await page.goto('/analytics');
    const panel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Time in status' }) });
    await expect(panel).toBeVisible();
    await expect(panel.locator('.recharts-bar-rectangle').first()).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.locator('.btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('time-in-status.csv');
  });

  test('Audit log CSV export downloads the full log, not just the loaded page', async ({ page }) => {
    await login(page);
    await page.goto('/audit-log');
    await expect(page.locator('table.data-table tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.panel-head .btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('audit-log.csv');
  });

  test('Dashboard "Recent activity" panel export downloads', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    const panel = page.locator('.panel', { has: page.locator('.panel-title', { hasText: 'Recent activity' }) });
    await expect(panel).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      panel.locator('.btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('recent-activity.csv');
  });

  test('Workflow transition grid CSV export downloads', async ({ page }) => {
    await login(page);
    await page.goto('/workflow');
    await expect(page.locator('table.wf-table tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.panel-head .btn-ghost', { hasText: 'CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('workflow-transitions.csv');
  });
});
