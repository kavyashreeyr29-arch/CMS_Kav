import { test, expect, APIRequestContext } from '@playwright/test';
import { login } from './fixtures';

// Coverage for CHANGELOG.md's ticket-linking pass — copy a shareable link,
// auto-linked ticket references inside comments/descriptions, sub-task
// creation, and converting a sub-task back to a standalone ticket.
const API_BASE = 'http://localhost:3000/api/v1';
const REQUESTER_EMAIL = 'pmanager@elevatohub.io'; // Admin

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

async function createTicket(request: APIRequestContext, t: string, title: string, extra: Record<string, unknown> = {}) {
  const res = await request.post(`${API_BASE}/tickets`, {
    headers: auth(t), data: { projectCode: 'ATLAS', title, type: 'Task', priority: 'Medium', source: 'InternalPM', ...extra },
  });
  return res.json();
}

test.describe('Ticket linking — API', () => {
  test('a ticket can be looked up by displayId as well as its internal id', async ({ request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const ticket = await createTicket(request, t, `E2E displayId lookup ${Date.now()}`);

    const byId = await request.get(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(t) });
    const byDisplayId = await request.get(`${API_BASE}/tickets/${ticket.displayId}`, { headers: auth(t) });
    expect(byId.ok()).toBeTruthy();
    expect(byDisplayId.ok()).toBeTruthy();
    expect((await byId.json()).id).toBe((await byDisplayId.json()).id);
  });

  test('a ticket can be created as a sub-task, then converted to standalone', async ({ request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const parent = await createTicket(request, t, `E2E parent ${Date.now()}`);
    const child = await createTicket(request, t, `E2E child ${Date.now()}`, { parentTicketId: parent.id });
    expect(child.parentTicketId).toBe(parent.id);

    const parentAfter = await (await request.get(`${API_BASE}/tickets/${parent.id}`, { headers: auth(t) })).json();
    expect(parentAfter.children.map((c: { id: string }) => c.id)).toContain(child.id);

    const converted = await request.patch(`${API_BASE}/tickets/${child.id}/parent`, { headers: auth(t), data: { parentTicketId: null } });
    expect(converted.ok()).toBeTruthy();
    expect((await converted.json()).parentTicketId).toBeNull();
  });

  test('a ticket cannot be set as its own parent, or create a circular chain', async ({ request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const a = await createTicket(request, t, `E2E cycle A ${Date.now()}`);

    const selfParent = await request.patch(`${API_BASE}/tickets/${a.id}/parent`, { headers: auth(t), data: { parentTicketId: a.id } });
    expect(selfParent.status()).toBe(400);

    const b = await createTicket(request, t, `E2E cycle B ${Date.now()}`, { parentTicketId: a.id });
    // b's parent is a; setting a's parent to b would create a 2-cycle.
    const cycle = await request.patch(`${API_BASE}/tickets/${a.id}/parent`, { headers: auth(t), data: { parentTicketId: b.id } });
    expect(cycle.status()).toBe(400);
  });
});

test.describe('Ticket linking — UI', () => {
  test('Copy link copies a displayId-based, shareable URL', async ({ page, context, request }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const t = await token(request, REQUESTER_EMAIL);
    const ticket = await createTicket(request, t, `E2E copy link ${Date.now()}`);

    await login(page, REQUESTER_EMAIL);
    await page.goto(`/tickets/${ticket.id}`);
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(`${page.url().split('/tickets/')[0]}/tickets/${ticket.displayId}`);
  });

  test('Add sub-task creates a child ticket and navigates to it with "Part of" shown; converting removes it', async ({ page, request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const parent = await createTicket(request, t, `E2E UI parent ${Date.now()}`);

    await login(page, REQUESTER_EMAIL);
    await page.goto(`/tickets/${parent.id}`);
    await page.getByRole('button', { name: 'Add sub-task' }).click();
    await expect(page.locator('.modal-title')).toHaveText('New sub-task');
    await expect(page.locator('.field-note', { hasText: 'Sub-task of' })).toContainText(parent.displayId);

    const childTitle = `E2E UI sub-task ${Date.now()}`;
    await page.locator('#ct-title').fill(childTitle);
    await page.getByRole('button', { name: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/);
    await expect(page.locator('.td-parent-info')).toContainText(parent.displayId);

    await page.getByRole('button', { name: 'Convert to standalone ticket' }).click();
    await expect(page.locator('.td-parent-info')).toHaveCount(0);
  });

  test('a bare ticket reference in a comment is auto-linked and navigates to that ticket', async ({ page, request }) => {
    const t = await token(request, REQUESTER_EMAIL);
    const referenced = await createTicket(request, t, `E2E referenced ticket ${Date.now()}`);
    const host = await createTicket(request, t, `E2E comment host ${Date.now()}`);

    await login(page, REQUESTER_EMAIL);
    await page.goto(`/tickets/${host.id}`);
    await page.locator('textarea[placeholder="Add a comment…"]').fill(`See ${referenced.displayId} for context.`);
    await page.locator('.send-btn').click();

    const refLink = page.locator('.comment-text .ref-link.tid', { hasText: referenced.displayId });
    await expect(refLink).toBeVisible();
    await refLink.click();
    await expect(page.locator('.tid.mono')).toHaveText(referenced.displayId);
  });
});
