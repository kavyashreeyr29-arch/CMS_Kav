import { test, expect, APIRequestContext } from '@playwright/test';
import { login, SEED_ADMIN_EMAIL } from './fixtures';

// Coverage for admin-configurable per-team "Team hours" access
// (CHANGELOG.md) — Team.hoursViewerUserIds/hoursViewerRoleIds. Admin,
// Director, PM (org-wide) and a team's own Lead could already see it;
// this adds an admin-defined grant list, layered on top, so a specific
// person or a whole role can be given access to one team's hours without
// their role's own workHoursVisibility default changing anywhere else.
const API_BASE = 'http://localhost:3000/api/v1';

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

test.describe('Team hours access grants — API', () => {
  test('an individually-granted user gets team-scoped access; revoking it takes it away again', async ({ request }) => {
    const adminT = await token(request, SEED_ADMIN_EMAIL);
    const suffix = Date.now();

    // 'operations' defaults to workHoursVisibility: 'none' — the strictest
    // starting point, so a pass here proves the grant works independent of
    // (not just on top of) the role's own default.
    const grantee = await (await request.post(`${API_BASE}/users`, {
      headers: auth(adminT), data: { name: `E2E Hours Grantee ${suffix}`, email: `e2e-hours-grantee-${suffix}@test.local`, password: 'password123', baseRoleId: 'operations' },
    })).json();
    const member = await (await request.post(`${API_BASE}/users`, {
      headers: auth(adminT), data: { name: `E2E Hours Member ${suffix}`, email: `e2e-hours-member-${suffix}@test.local`, password: 'password123', baseRoleId: 'senior_developer' },
    })).json();
    const team = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(adminT), data: { name: `E2E Hours Team ${suffix}`, memberUserIds: [member.id] },
    })).json();

    const granteeT = await token(request, grantee.email);
    const before = await request.get(`${API_BASE}/reports/work-hours?date=2026-08-17`, { headers: auth(granteeT) });
    expect(before.status()).toBe(403);

    const grant = await request.patch(`${API_BASE}/teams/${team.id}`, {
      headers: auth(adminT), data: { hoursViewerUserIds: [grantee.id] },
    });
    expect(grant.ok()).toBeTruthy();

    const meAfter = await (await request.get(`${API_BASE}/auth/me`, { headers: auth(granteeT) })).json();
    expect(meAfter.permissions.workHoursVisibility).toBe('team');

    const after = await request.get(`${API_BASE}/reports/work-hours?startDate=2026-01-01&endDate=2026-12-31`, { headers: auth(granteeT) });
    expect(after.ok()).toBeTruthy();
    const rows = await after.json();
    // Only this team's member(s) — not an org-wide dump — even though the
    // grantee's own base role has zero visibility of its own.
    expect(rows.every((r: { name: string }) => r.name !== 'P. Manager')).toBeTruthy();

    await request.patch(`${API_BASE}/teams/${team.id}`, { headers: auth(adminT), data: { hoursViewerUserIds: [] } });
    const revoked = await request.get(`${API_BASE}/reports/work-hours?date=2026-08-17`, { headers: auth(granteeT) });
    expect(revoked.status()).toBe(403);

    await request.delete(`${API_BASE}/teams/${team.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/users/${grantee.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/users/${member.id}`, { headers: auth(adminT) });
  });

  test('a role-based grant gives everyone with that role access, independent of any per-user grant', async ({ request }) => {
    const adminT = await token(request, SEED_ADMIN_EMAIL);
    const suffix = Date.now();

    const roleHolder = await (await request.post(`${API_BASE}/users`, {
      headers: auth(adminT), data: { name: `E2E Role Grant ${suffix}`, email: `e2e-role-grant-${suffix}@test.local`, password: 'password123', baseRoleId: 'callcenter' },
    })).json();
    const team = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(adminT), data: { name: `E2E Role Grant Team ${suffix}`, hoursViewerRoleIds: ['callcenter'] },
    })).json();

    const t = await token(request, roleHolder.email);
    const me = await (await request.get(`${API_BASE}/auth/me`, { headers: auth(t) })).json();
    expect(me.permissions.workHoursVisibility).toBe('team');
    const res = await request.get(`${API_BASE}/reports/work-hours?date=2026-08-17`, { headers: auth(t) });
    expect(res.ok()).toBeTruthy();

    await request.delete(`${API_BASE}/teams/${team.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/users/${roleHolder.id}`, { headers: auth(adminT) });
  });

  test('an unknown role id is rejected when setting hoursViewerRoleIds', async ({ request }) => {
    const adminT = await token(request, SEED_ADMIN_EMAIL);
    const team = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(adminT), data: { name: `E2E Invalid Role Grant ${Date.now()}` },
    })).json();

    const res = await request.patch(`${API_BASE}/teams/${team.id}`, {
      headers: auth(adminT), data: { hoursViewerRoleIds: ['not-a-real-role'] },
    });
    expect(res.status()).toBe(400);

    await request.delete(`${API_BASE}/teams/${team.id}`, { headers: auth(adminT) });
  });
});

test.describe('Team hours access grants — UI', () => {
  test('TeamsAdmin: granting a role and a person under "Who else can view this team\'s hours" persists', async ({ page, request }) => {
    const adminT = await token(request, SEED_ADMIN_EMAIL);
    const suffix = Date.now();
    const teamName = `E2E UI Hours Grant Team ${suffix}`;

    await login(page);
    await page.goto('/teams');
    await page.locator('.btn-primary', { hasText: 'New team' }).click();
    await page.locator('.modal #team-name').fill(teamName);
    await page.locator('.modal-foot .btn-primary', { hasText: 'Create team' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New team' })).toHaveCount(0, { timeout: 10000 });

    await page.locator('.panel', { hasText: teamName }).click();
    await expect(page.locator('.modal-title', { hasText: `Edit ${teamName}` })).toBeVisible();

    const grantSection = page.locator('.field.full', { has: page.locator('#team-hours-viewers-label') });
    await grantSection.locator('.watcher-chip', { hasText: 'QA (role)' }).click();
    await grantSection.locator('.watcher-chip', { hasText: 'F. Haddad' }).click();
    await page.locator('.modal-foot .btn-primary', { hasText: 'Save changes' }).click();
    await expect(page.locator('.modal-title')).toHaveCount(0, { timeout: 10000 });

    // Re-open and confirm both grants persisted as active chips.
    await page.locator('.panel', { hasText: teamName }).click();
    const reopened = page.locator('.field.full', { has: page.locator('#team-hours-viewers-label') });
    await expect(reopened.locator('.watcher-chip.active', { hasText: 'QA (role)' })).toBeVisible();
    await expect(reopened.locator('.watcher-chip.active', { hasText: 'F. Haddad' })).toBeVisible();

    // Clean up via the API (faster/more reliable than un-toggling both in the UI again).
    await page.locator('.modal-close').click();
    const teams = await (await request.get(`${API_BASE}/teams`, { headers: auth(adminT) })).json();
    const created = teams.find((t: { name: string }) => t.name === teamName);
    if (created) await request.delete(`${API_BASE}/teams/${created.id}`, { headers: auth(adminT) });
  });
});
