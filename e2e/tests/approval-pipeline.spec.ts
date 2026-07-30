import { test, expect, APIRequestContext } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the pre-development intake/approval pipeline (CHANGELOG.md) —
// RequirementGathering/CommercialApproval/RequirementApproval/ManagerApproval
// statuses, the generic ApprovalRequest entity ("send for approval" / decide),
// and the requiresApproval workflow gate tying them together.
const API_BASE = 'http://localhost:3000/api/v1';
const REQUESTER_EMAIL = 'pmanager@elevatohub.io'; // Admin
const APPROVER_EMAIL = 'nrao@elevatohub.io'; // Director

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

async function createChangeRequest(request: APIRequestContext, t: string, title: string) {
  const res = await request.post(`${API_BASE}/tickets`, {
    headers: auth(t), data: { projectCode: 'ATLAS', title, type: 'ChangeRequest', priority: 'Medium', source: 'InternalPM' },
  });
  return res.json();
}

test.describe('Approval pipeline — API', () => {
  test('a new ChangeRequest ticket starts in RequirementGathering, not Open', async ({ request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const ticket = await createChangeRequest(request, t, `E2E CR intake ${Date.now()}`);
    expect(ticket.status).toBe('RequirementGathering');
  });

  test('a Task ticket still starts in Open (governance types only)', async ({ request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const res = await request.post(`${API_BASE}/tickets`, {
      headers: auth(t), data: { projectCode: 'ATLAS', title: `E2E task ${Date.now()}`, type: 'Task', priority: 'Medium', source: 'InternalPM' },
    });
    expect((await res.json()).status).toBe('Open');
  });

  test('moving straight to CommercialApproval is blocked without an approved request', async ({ request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const ticket = await createChangeRequest(request, t, `E2E CR blocked ${Date.now()}`);
    const res = await request.patch(`${API_BASE}/tickets/${ticket.id}/status`, { headers: auth(t), data: { status: 'CommercialApproval' } });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('Commercial Approval');
  });

  test('full cycle: send for approval → non-approver forbidden → approver approves → transition allowed', async ({ request }) => {
    const reqToken = await token(request, REQUESTER_EMAIL);
    const approverToken = await token(request, APPROVER_EMAIL);
    const approver = await (await request.post(`${API_BASE}/auth/login`, { data: { email: APPROVER_EMAIL, password: 'password123' } })).json();
    const approverId = approver.user.id;

    const ticket = await createChangeRequest(request, reqToken, `E2E CR cycle ${Date.now()}`);

    const created = await request.post(`${API_BASE}/approvals`, {
      headers: auth(reqToken),
      data: { ticketId: ticket.id, label: 'Commercial Approval', approverUserId: approverId, requestNote: 'Please review pricing.' },
    });
    expect(created.ok()).toBeTruthy();
    const approvalRequest = await created.json();
    expect(approvalRequest.decision).toBe('pending');

    // A third party (the requester themself, not the designated approver) cannot decide.
    const forbidden = await request.patch(`${API_BASE}/approvals/${approvalRequest.id}/decide`, {
      headers: auth(reqToken), data: { decision: 'approved' },
    });
    expect(forbidden.status()).toBe(403);

    // The designated approver can.
    const decided = await request.patch(`${API_BASE}/approvals/${approvalRequest.id}/decide`, {
      headers: auth(approverToken), data: { decision: 'approved' },
    });
    expect(decided.ok()).toBeTruthy();
    expect((await decided.json()).decision).toBe('approved');

    // Now the transition succeeds.
    const moved = await request.patch(`${API_BASE}/tickets/${ticket.id}/status`, { headers: auth(reqToken), data: { status: 'CommercialApproval' } });
    expect(moved.ok()).toBeTruthy();
    expect((await moved.json()).status).toBe('CommercialApproval');
  });

  test('rejecting requires a comment, and blocks the transition until a fresh approved request exists', async ({ request }) => {
    const reqToken = await token(request, REQUESTER_EMAIL);
    const approverToken = await token(request, APPROVER_EMAIL);
    const approver = await (await request.post(`${API_BASE}/auth/login`, { data: { email: APPROVER_EMAIL, password: 'password123' } })).json();

    const ticket = await createChangeRequest(request, reqToken, `E2E CR reject ${Date.now()}`);
    const created = await (await request.post(`${API_BASE}/approvals`, {
      headers: auth(reqToken), data: { ticketId: ticket.id, label: 'Commercial Approval', approverUserId: approver.user.id },
    })).json();

    // No comment → rejected.
    const noComment = await request.patch(`${API_BASE}/approvals/${created.id}/decide`, { headers: auth(approverToken), data: { decision: 'rejected' } });
    expect(noComment.status()).toBe(400);

    const rejected = await request.patch(`${API_BASE}/approvals/${created.id}/decide`, {
      headers: auth(approverToken), data: { decision: 'rejected', comment: 'Pricing model needs revision.' },
    });
    expect(rejected.ok()).toBeTruthy();
    expect((await rejected.json()).decisionComment).toBe('Pricing model needs revision.');

    const stillBlocked = await request.patch(`${API_BASE}/tickets/${ticket.id}/status`, { headers: auth(reqToken), data: { status: 'CommercialApproval' } });
    expect(stillBlocked.status()).toBe(400);

    // Full audit history is retained — both the rejected request and nothing else.
    const history = await (await request.get(`${API_BASE}/approvals?ticketId=${ticket.id}`, { headers: auth(reqToken) })).json();
    expect(history).toHaveLength(1);
    expect(history[0].decision).toBe('rejected');
  });
});

test.describe('Approval pipeline — UI', () => {
  test('Ticket detail shows an Approvals panel with Send for approval', async ({ page, request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const ticket = await createChangeRequest(request, t, `E2E CR ui ${Date.now()}`);

    await login(page);
    await page.goto(`/tickets/${ticket.id}`);
    const panel = page.getByTestId('approvals-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('No approval requests yet')).toBeVisible();

    await panel.getByRole('button', { name: 'Send for approval' }).click();
    await panel.locator('#appr-label').fill('Commercial Approval');
    await panel.locator('#appr-approver').selectOption({ label: 'N. Rao' });
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.locator('.pr-badge', { hasText: 'Pending' })).toBeVisible();
  });

  test('Board Status grouping shows the intake pipeline columns plus Closed', async ({ page }) => {
    await login(page);
    await page.goto('/kanban');
    await expect(page.locator('.kcol-title', { hasText: 'Requirement Gathering' })).toBeVisible();
    await expect(page.locator('.kcol-title', { hasText: 'Commercial Approval' })).toBeVisible();
    await expect(page.locator('.kcol-title', { hasText: 'Requirement Approval' })).toBeVisible();
    await expect(page.locator('.kcol-title', { hasText: 'Manager Approval' })).toBeVisible();
    // All 11 columns exist in the DOM even though only some fit on screen —
    // .kanban-columns scrolls horizontally rather than wrapping.
    await expect(page.locator('.kcol-title', { hasText: 'Closed' })).toBeAttached();
  });

  test('The designated approver can reject with a comment through the UI, and it shows in the history', async ({ page, request }) => {
    const reqToken = await token(request, REQUESTER_EMAIL);
    const ticket = await createChangeRequest(request, reqToken, `E2E UI reject ${Date.now()}`);
    const approver = await (await request.post(`${API_BASE}/auth/login`, { data: { email: APPROVER_EMAIL, password: 'password123' } })).json();
    await request.post(`${API_BASE}/approvals`, {
      headers: auth(reqToken), data: { ticketId: ticket.id, label: 'Commercial Approval', approverUserId: approver.user.id },
    });

    await login(page, APPROVER_EMAIL);
    await page.goto(`/tickets/${ticket.id}`);
    const panel = page.getByTestId('approvals-panel');
    await expect(panel.locator('.pr-badge', { hasText: 'Pending' })).toBeVisible();

    // Approve/Reject/Request-changes show up front with no comment box —
    // the box only appears once an action that needs one is chosen.
    await expect(panel.locator('.approval-comment-box')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Reject' }).click();
    await expect(panel.locator('.approval-comment-box textarea')).toBeVisible();

    // Confirming with no comment is rejected client-side.
    await panel.getByRole('button', { name: 'Confirm reject' }).click();
    await expect(page.locator('.field-error')).toBeVisible();

    await panel.locator('.approval-comment-box textarea').fill('Scope is unclear — please add acceptance criteria.');
    await panel.getByRole('button', { name: 'Confirm reject' }).click();
    await expect(panel.locator('.pr-badge', { hasText: 'Rejected' })).toBeVisible();
    await expect(panel).toContainText('Scope is unclear — please add acceptance criteria.');
  });
});
