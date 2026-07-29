import { test, expect, APIRequestContext } from '@playwright/test';
import { createHmac } from 'crypto';
import { login } from './fixtures';

// Coverage for the admin-configurable workflow gates (CHANGELOG.md) — the
// transition matrix + gate conditions that replace the old "any status to any
// status" behavior. UI config is verified through the /workflow admin page;
// gate enforcement is verified at the API level (deterministic), including a
// GitHub-linked merged PR satisfying a requiresMergedPr gate.
const API_BASE = 'http://localhost:3000/api/v1';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email: 'pmanager@elevatohub.io', password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(token: string) { return { Authorization: `Bearer ${token}` }; }
function sign(secret: string, body: string) { return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex'); }

async function getWorkflow(request: APIRequestContext, token: string) {
  return (await request.get(`${API_BASE}/workflow`, { headers: auth(token) })).json();
}
async function putWorkflow(request: APIRequestContext, token: string, transitions: unknown[]) {
  return request.put(`${API_BASE}/workflow`, { headers: auth(token), data: { transitions } });
}
type Row = { fromStatus: string; toStatus: string; requiresAssignee: boolean; requiresLinkedPr: boolean; requiresApprovedPr: boolean; requiresMergedPr: boolean; requiresQaPass: boolean; allowedRoleIds: string[] };
function strip(rows: Row[]): Row[] {
  return rows.map((r) => ({
    fromStatus: r.fromStatus, toStatus: r.toStatus, requiresAssignee: r.requiresAssignee,
    requiresLinkedPr: r.requiresLinkedPr, requiresApprovedPr: r.requiresApprovedPr,
    requiresMergedPr: r.requiresMergedPr, requiresQaPass: r.requiresQaPass, allowedRoleIds: r.allowedRoleIds,
  }));
}

test.describe('Workflow gates — admin config', () => {
  test('Admin sees the Workflow nav item and the seeded default transition matrix', async ({ page }) => {
    await login(page);
    await expect(page.locator('.sidebar-nav a[href="/workflow"]')).toBeVisible();
    await page.goto('/workflow');
    await expect(page.locator('.wf-table')).toBeVisible();
    // Default is permissive: In Progress → In Review exists with no gates ticked.
    await expect(page.locator('.wf-table tbody tr')).not.toHaveCount(0);
  });

  test('Director (no manageWorkflow) does not see the Workflow nav item', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Director', exact: true }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator('.sidebar-nav a[href="/workflow"]')).toHaveCount(0);
  });

  test('Toggling a gate and saving persists after reload', async ({ page }) => {
    await login(page);
    await page.goto('/workflow');
    await expect(page.locator('.wf-table')).toBeVisible();

    // First gate checkbox of the first row — toggle, save, reload, still set.
    const firstCheckbox = page.locator('.wf-table tbody tr').first().locator('input[type="checkbox"]').first();
    const wasChecked = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    await page.getByRole('button', { name: /Save workflow/ }).click();
    await expect(page.locator('.field-note', { hasText: 'Workflow saved' })).toBeVisible();

    await page.reload();
    await expect(page.locator('.wf-table tbody tr').first().locator('input[type="checkbox"]').first()).toBeChecked({ checked: !wasChecked });

    // Restore it so we don't leave a stray gate for other tests.
    await page.locator('.wf-table tbody tr').first().locator('input[type="checkbox"]').first().click();
    await page.getByRole('button', { name: /Save workflow/ }).click();
    await expect(page.locator('.field-note', { hasText: 'Workflow saved' })).toBeVisible();
  });
});

test.describe('Workflow gates — enforcement', () => {
  test('a requiresMergedPr gate blocks Completed until a merged PR is linked, then allows it', async ({ request }) => {
    const token = await adminToken(request);
    const original = strip(await getWorkflow(request, token));

    try {
      // Turn on requiresMergedPr for QATesting → Completed.
      const edited = original.map((r) =>
        r.fromStatus === 'QATesting' && r.toStatus === 'Completed' ? { ...r, requiresMergedPr: true } : r,
      );
      expect(await (await putWorkflow(request, token, edited)).status()).toBe(200);

      // Create a ticket and walk it to QATesting (all default, ungated moves).
      const created = await (await request.post(`${API_BASE}/tickets`, {
        headers: auth(token), data: { projectCode: 'ATLAS', title: `E2E gate ${Date.now()}`, type: 'Task', priority: 'Medium', source: 'InternalPM' },
      })).json();
      for (const s of ['InProgress', 'InReview', 'QATesting']) {
        expect((await request.patch(`${API_BASE}/tickets/${created.id}/status`, { headers: auth(token), data: { status: s } })).ok()).toBeTruthy();
      }

      // Completed is blocked — no merged PR.
      const blocked = await request.patch(`${API_BASE}/tickets/${created.id}/status`, { headers: auth(token), data: { status: 'Completed' } });
      expect(blocked.status()).toBe(400);
      expect(JSON.stringify(await blocked.json())).toContain('merged pull request');

      // Link a merged PR via a signed webhook, then Completed is allowed.
      const secret = (await (await request.put(`${API_BASE}/github/integration`, {
        headers: auth(token), data: { repoOwner: 'e', repoName: 'r', autoTransition: false },
      })).json()).webhookSecret;
      const body = JSON.stringify({
        action: 'closed',
        pull_request: { number: 7030, title: `${created.displayId} done`, html_url: 'u', head: { ref: created.displayId }, user: { login: 'd' }, body: '', state: 'closed', merged: true },
      });
      expect((await request.post(`${API_BASE}/github/webhook`, {
        headers: { 'X-GitHub-Event': 'pull_request', 'X-Hub-Signature-256': sign(secret, body), 'Content-Type': 'application/json' }, data: body,
      })).status()).toBe(200);

      const allowed = await request.patch(`${API_BASE}/tickets/${created.id}/status`, { headers: auth(token), data: { status: 'Completed' } });
      expect(allowed.ok()).toBeTruthy();
      expect((await allowed.json()).status).toBe('Completed');
    } finally {
      // Always restore the original workflow so enforcement doesn't leak into other specs.
      await putWorkflow(request, token, original);
    }
  });
});
