import { test, expect, APIRequestContext } from '@playwright/test';
import { createHmac } from 'crypto';
import { login } from './fixtures';

// Coverage for the GitHub integration (CHANGELOG.md) — the webhook receiver
// is a machine-to-machine, HMAC-signed endpoint (no JWT), so per CLAUDE.md's
// "hit the endpoint directly" bar this drives it with Playwright's `request`
// fixture (signing payloads with Node crypto exactly as GitHub would), then
// verifies the linked PR + auto-transitioned status through the real UI.
const API_BASE = 'http://localhost:3000/api/v1';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: 'pmanager@elevatohub.io', password: 'password123' },
  });
  return (await res.json()).accessToken;
}

function sign(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

async function createTicket(request: APIRequestContext, token: string, title: string): Promise<{ id: string; displayId: string }> {
  const res = await request.post(`${API_BASE}/tickets`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { projectCode: 'ATLAS', title, type: 'Task', priority: 'Medium', source: 'InternalPM' },
  });
  const t = await res.json();
  return { id: t.id, displayId: t.displayId };
}

async function setStatus(request: APIRequestContext, token: string, id: string, status: string) {
  return request.patch(`${API_BASE}/tickets/${id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status },
  });
}

async function configureIntegration(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.put(`${API_BASE}/github/integration`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      repoOwner: 'elevatoz', repoName: 'elevatozhub', autoTransition: true,
      onPrOpenedStatus: 'InReview', onPrApprovedStatus: 'QATesting', onPrMergedStatus: 'Completed',
    },
  });
  return (await res.json()).webhookSecret;
}

test.describe('GitHub webhook integration', () => {
  test('rejects a webhook with a missing or invalid signature', async ({ request }) => {
    const token = await adminToken(request);
    await configureIntegration(request, token);
    const payload = JSON.stringify({ action: 'opened', pull_request: { number: 1, title: 'x' } });

    const noSig = await request.post(`${API_BASE}/github/webhook`, {
      headers: { 'X-GitHub-Event': 'pull_request' }, data: JSON.parse(payload),
    });
    expect(noSig.status()).toBe(401);

    const badSig = await request.post(`${API_BASE}/github/webhook`, {
      headers: { 'X-GitHub-Event': 'pull_request', 'X-Hub-Signature-256': 'sha256=deadbeef' },
      data: JSON.parse(payload),
    });
    expect(badSig.status()).toBe(401);
  });

  test('a signed PR-opened webhook links the PR to its ticket and auto-transitions the status', async ({ page, request }) => {
    const token = await adminToken(request);
    const secret = await configureIntegration(request, token);
    const { id, displayId } = await createTicket(request, token, `E2E gh-open ${Date.now()}`);
    await setStatus(request, token, id, 'InProgress'); // InProgress → InReview is the auto-move

    const body = JSON.stringify({
      action: 'opened',
      pull_request: {
        number: 7010, title: `Implement ${displayId} feature`, html_url: 'https://github.com/x/y/pull/7010',
        head: { ref: `${displayId}-feature` }, user: { login: 'devx' }, body: `Closes ${displayId}`, state: 'open', merged: false,
      },
    });
    const res = await request.post(`${API_BASE}/github/webhook`, {
      headers: { 'X-GitHub-Event': 'pull_request', 'X-Hub-Signature-256': sign(secret, body), 'Content-Type': 'application/json' },
      data: body,
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).linked).toBe(1);

    const after = await (await request.get(`${API_BASE}/tickets/${id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(after.status).toBe('InReview'); // auto-transitioned on PR open
    expect(after.pullRequests).toHaveLength(1);
    expect(after.pullRequests[0].number).toBe(7010);

    // Development panel shows the linked PR in the real UI.
    await login(page);
    await page.goto(`/tickets/${id}`);
    const dev = page.locator('.panel', { has: page.locator('.td-section-title', { hasText: 'Development' }) });
    await expect(dev.locator('.pr-item')).toContainText('#7010');
    await expect(dev.locator('.pr-badge', { hasText: 'Open' })).toBeVisible();
  });

  test('a PR-review approved webhook records the approval on the linked PR', async ({ request }) => {
    const token = await adminToken(request);
    const secret = await configureIntegration(request, token);
    const { id, displayId } = await createTicket(request, token, `E2E gh-review ${Date.now()}`);
    await setStatus(request, token, id, 'InProgress');

    const openBody = JSON.stringify({
      action: 'opened',
      pull_request: { number: 7020, title: `${displayId} work`, html_url: 'u', head: { ref: `${displayId}` }, user: { login: 'd' }, body: '', state: 'open', merged: false },
    });
    await request.post(`${API_BASE}/github/webhook`, {
      headers: { 'X-GitHub-Event': 'pull_request', 'X-Hub-Signature-256': sign(secret, openBody), 'Content-Type': 'application/json' },
      data: openBody,
    });

    const reviewBody = JSON.stringify({
      action: 'submitted',
      review: { state: 'approved' },
      pull_request: { number: 7020, title: `${displayId} work`, html_url: 'u', head: { ref: `${displayId}` }, user: { login: 'd' }, body: '', state: 'open', merged: false },
    });
    const res = await request.post(`${API_BASE}/github/webhook`, {
      headers: { 'X-GitHub-Event': 'pull_request_review', 'X-Hub-Signature-256': sign(secret, reviewBody), 'Content-Type': 'application/json' },
      data: reviewBody,
    });
    expect(res.status()).toBe(200);

    const after = await (await request.get(`${API_BASE}/tickets/${id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const pr = after.pullRequests.find((p: { number: number }) => p.number === 7020);
    expect(pr.reviewState).toBe('approved');
  });
});
