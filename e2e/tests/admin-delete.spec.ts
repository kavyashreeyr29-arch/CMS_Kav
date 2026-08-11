import { test, expect, APIRequestContext } from '@playwright/test';
import { login, SEED_ADMIN_EMAIL } from './fixtures';

// Coverage for admin-only delete on Teams, Tickets, and Projects
// (CHANGELOG.md). Labels already had a delete option (soft-delete, gated on
// manageLabels) — these three didn't have one at all. Delete is a flat
// role-permission gate (userManagement, same key Team create/update already
// used), not "only rows an admin created" — neither Team nor Project track
// a creator field, and every other admin-style gate in this app works the
// same way (see role-permissions.ts).
const API_BASE = 'http://localhost:3000/api/v1';
const DIRECTOR_EMAIL = 'nrao@elevatohub.io'; // non-admin, for the forbidden-path checks

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

test.describe('Admin-only delete — API', () => {
  test('a non-admin gets 403 deleting a team, a ticket, or a project', async ({ request }) => {
    const t = await token(request, DIRECTOR_EMAIL);
    const team = await request.delete(`${API_BASE}/teams/nonexistent-id`, { headers: auth(t) });
    expect(team.status()).toBe(403);
    const ticket = await request.delete(`${API_BASE}/tickets/nonexistent-id`, { headers: auth(t) });
    expect(ticket.status()).toBe(403);
    const project = await request.delete(`${API_BASE}/projects/ATLAS`, { headers: auth(t) });
    expect(project.status()).toBe(403);
  });

  test('admin can create and delete a team; it stops appearing and the deletion is audit-logged', async ({ request }) => {
    const t = await token(request, SEED_ADMIN_EMAIL);
    const created = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(t), data: { name: `E2E API team ${Date.now()}` },
    })).json();

    const del = await request.delete(`${API_BASE}/teams/${created.id}`, { headers: auth(t) });
    expect(del.ok()).toBeTruthy();

    const stillThere = await request.get(`${API_BASE}/teams/${created.id}`, { headers: auth(t) });
    expect(stillThere.status()).toBe(404);

    const auditLog = await (await request.get(`${API_BASE}/audit-log?limit=5`, { headers: auth(t) })).json();
    const entry = auditLog.data.find((e: { action: string; targetId: string }) => e.action === 'team.deleted' && e.targetId === created.id);
    expect(entry).toBeTruthy();
  });

  test('admin can create and delete a ticket; it 404s afterward', async ({ request }) => {
    const t = await token(request, SEED_ADMIN_EMAIL);
    const created = await (await request.post(`${API_BASE}/tickets`, {
      headers: auth(t), data: { projectCode: 'ATLAS', title: `E2E API delete ticket ${Date.now()}`, type: 'Task', priority: 'Medium', source: 'InternalPM' },
    })).json();

    const del = await request.delete(`${API_BASE}/tickets/${created.id}`, { headers: auth(t) });
    expect(del.ok()).toBeTruthy();

    const stillThere = await request.get(`${API_BASE}/tickets/${created.id}`, { headers: auth(t) });
    expect(stillThere.status()).toBe(404);
  });

  test('deleting a project with existing tickets is blocked with a friendly message instead of a raw DB error', async ({ request }) => {
    const t = await token(request, SEED_ADMIN_EMAIL);
    const res = await request.delete(`${API_BASE}/projects/ATLAS`, { headers: auth(t) });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.message).toContain('still has');
    expect(body.message).toContain('ticket');

    // ATLAS must still be there — the delete should not have partially applied.
    const stillThere = await request.get(`${API_BASE}/projects/ATLAS`, { headers: auth(t) });
    expect(stillThere.ok()).toBeTruthy();
  });

  test('admin can delete a project once it has no tickets', async ({ request }) => {
    const t = await token(request, SEED_ADMIN_EMAIL);
    const me = await (await request.get(`${API_BASE}/auth/me`, { headers: auth(t) })).json();
    const code = `E2EDEL${Date.now()}`.slice(0, 12);
    await request.post(`${API_BASE}/projects`, {
      headers: auth(t),
      data: {
        code, name: 'E2E delete-verify project', client: 'Acme', pmUserId: me.user?.id ?? me.id,
        status: 'Planning', priority: 'Medium', startDate: '2026-01-01', endDate: '2026-12-31',
      },
    });

    const del = await request.delete(`${API_BASE}/projects/${code}`, { headers: auth(t) });
    expect(del.ok()).toBeTruthy();

    const stillThere = await request.get(`${API_BASE}/projects/${code}`, { headers: auth(t) });
    expect(stillThere.status()).toBe(404);
  });
});

test.describe('Admin-only delete — UI', () => {
  test('Teams admin: creating a team, then deleting it via the confirm dialog removes it from the grid', async ({ page }) => {
    await login(page);
    await page.goto('/teams');
    await expect(page.locator('.filter-bar')).toBeVisible();

    const teamName = `E2E UI delete team ${Date.now()}`;
    await page.locator('.btn-primary', { hasText: 'New team' }).click();
    await page.locator('.modal #team-name').fill(teamName);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create team' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New team' })).toHaveCount(0, { timeout: 10000 });

    const card = page.locator('.panel', { hasText: teamName });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.locator('.modal-title', { hasText: `Edit ${teamName}` })).toBeVisible();

    await page.locator('.modal-foot .btn-destructive', { hasText: 'Delete team' }).click();
    await expect(page.locator('.modal-title', { hasText: `Delete ${teamName}?` })).toBeVisible();
    await page.locator('.overlay .modal .btn-destructive', { hasText: 'Delete' }).last().click();

    await expect(page.locator('.modal-title')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.panel', { hasText: teamName })).toHaveCount(0);
  });

  test('Ticket detail: admin sees a delete button, a non-admin does not', async ({ page, request }) => {
    const t = await token(request, SEED_ADMIN_EMAIL);
    const created = await (await request.post(`${API_BASE}/tickets`, {
      headers: auth(t), data: { projectCode: 'ATLAS', title: `E2E UI delete-visibility ticket ${Date.now()}`, type: 'Task', priority: 'Medium', source: 'InternalPM' },
    })).json();

    await login(page, DIRECTOR_EMAIL);
    await page.goto(`/tickets/${created.id}`);
    await expect(page.getByTestId('td-delete-ticket')).toHaveCount(0);

    await page.evaluate(() => localStorage.clear());
    await login(page);
    await page.goto(`/tickets/${created.id}`);
    await expect(page.getByTestId('td-delete-ticket')).toBeVisible();

    // Clean up via the UI itself — also covers the full confirm → delete → navigate-away flow.
    await page.getByTestId('td-delete-ticket').click();
    await expect(page.locator('.modal-title', { hasText: 'Delete' })).toBeVisible();
    await page.locator('.overlay .modal .btn-destructive', { hasText: 'Delete' }).last().click();
    await expect(page.locator(`text=${created.id}`)).toHaveCount(0, { timeout: 10000 });

    const stillThere = await request.get(`${API_BASE}/tickets/${created.id}`, { headers: auth(t) });
    expect(stillThere.status()).toBe(404);
  });

  test('Project detail: admin sees a delete button; deleting a project with tickets shows the blocked message inline', async ({ page }) => {
    await login(page, DIRECTOR_EMAIL);
    await page.goto('/projects/ATLAS');
    await expect(page.getByTestId('pd-delete-project')).toHaveCount(0);

    await page.evaluate(() => localStorage.clear());
    await login(page);
    await page.goto('/projects/ATLAS');
    await expect(page.getByTestId('pd-delete-project')).toBeVisible();

    await page.getByTestId('pd-delete-project').click();
    await expect(page.locator('.modal-title', { hasText: 'Delete ATLAS?' })).toBeVisible();
    await expect(page.locator('.overlay .modal')).toContainText('ticket');
  });
});
