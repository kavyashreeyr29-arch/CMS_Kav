import { test, expect, APIRequestContext } from '@playwright/test';
import { login, SEED_ADMIN_EMAIL } from './fixtures';

// Coverage for cross-team ticket visibility (CHANGELOG.md) — a ticket homed
// in one team's project (e.g. a call-center-raised redemption issue routed
// to a Tech project) can tag other teams (Ops, CS, ...) as collaborators so
// their Leads/Managers — normally hard-scoped to only their own team's
// projects (ticketVisibilityWhere's 'team' case) — can actually open it,
// not just get notified about it the way a watcher would.
//
// Only Lead/Manager seniority narrows to 'team' scope, and only when the
// base role isn't already org-wide (admin/director/pm) — see
// effective-permissions.ts. The seed data's one such account is baseRoleId
// 'lead' (V. Kapoor / Delivery Squad); this test builds a second one from
// scratch since proving cross-*team* visibility needs two distinct teams
// with two distinct team-scoped leads, and cleans up everything it creates.
const API_BASE = 'http://localhost:3000/api/v1';

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

test.describe('Cross-team ticket visibility — API', () => {
  test('a Lead cannot see a ticket homed in another team\'s project until that team is tagged as a collaborator', async ({ request }) => {
    const adminT = await token(request, SEED_ADMIN_EMAIL);
    const suffix = Date.now();

    // Two throwaway teams, each with its own team-scoped Lead.
    const homeLead = await (await request.post(`${API_BASE}/users`, {
      headers: auth(adminT), data: { name: `E2E Home Lead ${suffix}`, email: `e2e-home-${suffix}@test.local`, password: 'password123', baseRoleId: 'senior_developer', seniority: 'lead' },
    })).json();
    const collabLead = await (await request.post(`${API_BASE}/users`, {
      headers: auth(adminT), data: { name: `E2E Collab Lead ${suffix}`, email: `e2e-collab-${suffix}@test.local`, password: 'password123', baseRoleId: 'senior_developer', seniority: 'lead' },
    })).json();
    const homeTeam = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(adminT), data: { name: `E2E Home Team ${suffix}`, leadUserId: homeLead.id },
    })).json();
    const collabTeam = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(adminT), data: { name: `E2E Collab Team ${suffix}`, leadUserId: collabLead.id },
    })).json();

    // A throwaway project owned by the home team, and a ticket under it.
    const code = `E2EXT${suffix}`.slice(0, 12);
    await request.post(`${API_BASE}/projects`, {
      headers: auth(adminT),
      data: {
        code, name: 'E2E cross-team project', client: 'Acme', pmUserId: homeLead.id, teamId: homeTeam.id,
        status: 'Planning', priority: 'Medium', startDate: '2026-01-01', endDate: '2026-12-31',
      },
    });
    const ticket = await (await request.post(`${API_BASE}/tickets`, {
      headers: auth(adminT), data: { projectCode: code, title: `E2E cross-team ticket ${suffix}`, type: 'Task', priority: 'Medium', source: 'CallCenter' },
    })).json();

    // The collaborating team's Lead can't see it yet — team scope only
    // covers the home team's own project.
    const collabT = await token(request, `e2e-collab-${suffix}@test.local`);
    const blocked = await request.get(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(collabT) });
    expect(blocked.status()).toBe(404);

    // Tag the collaborating team on the ticket.
    const linked = await request.patch(`${API_BASE}/tickets/${ticket.id}/collaborating-teams`, {
      headers: auth(adminT), data: { teamIds: [collabTeam.id] },
    });
    expect(linked.ok()).toBeTruthy();

    // Now the collaborating team's Lead can see it, and the change is logged.
    const visible = await request.get(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(collabT) });
    expect(visible.ok()).toBeTruthy();
    const fieldChanges = await (await request.get(`${API_BASE}/tickets/${ticket.id}/field-changes`, { headers: auth(adminT) })).json();
    expect(fieldChanges.some((c: { fieldName: string; newValue: string }) => c.fieldName === 'Collaborating teams' && c.newValue?.includes('E2E Collab Team'))).toBeTruthy();

    // The home team's own Lead could always see it, unaffected.
    const homeT = await token(request, `e2e-home-${suffix}@test.local`);
    const homeSees = await request.get(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(homeT) });
    expect(homeSees.ok()).toBeTruthy();

    // Untag it — visibility narrows back for the collaborating Lead.
    await request.patch(`${API_BASE}/tickets/${ticket.id}/collaborating-teams`, { headers: auth(adminT), data: { teamIds: [] } });
    const blockedAgain = await request.get(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(collabT) });
    expect(blockedAgain.status()).toBe(404);

    // Cleanup.
    await request.delete(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/projects/${code}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/teams/${homeTeam.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/teams/${collabTeam.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/users/${homeLead.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/users/${collabLead.id}`, { headers: auth(adminT) });
  });
});

test.describe('Cross-team ticket visibility — UI', () => {
  test('Ticket detail: adding and removing a collaborating team updates the chip list', async ({ page, request }) => {
    const adminT = await token(request, SEED_ADMIN_EMAIL);
    const suffix = Date.now();
    const team = await (await request.post(`${API_BASE}/teams`, {
      headers: auth(adminT), data: { name: `E2E UI collab team ${suffix}` },
    })).json();
    const ticket = await (await request.post(`${API_BASE}/tickets`, {
      headers: auth(adminT), data: { projectCode: 'ATLAS', title: `E2E UI collab ticket ${suffix}`, type: 'Task', priority: 'Medium', source: 'CallCenter' },
    })).json();

    await login(page);
    await page.goto(`/tickets/${ticket.id}`);
    const panel = page.getByTestId('td-collaborating-teams');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Only this ticket's own project team has visibility.");

    await panel.locator('select').selectOption({ label: team.name });
    await panel.getByRole('button', { name: 'Add' }).click();
    await expect(panel.locator('.watcher-chip', { hasText: team.name })).toBeVisible({ timeout: 10000 });

    await panel.locator('.watcher-chip', { hasText: team.name }).locator('svg').click();
    await expect(panel.locator('.watcher-chip', { hasText: team.name })).toHaveCount(0, { timeout: 10000 });

    await request.delete(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(adminT) });
    await request.delete(`${API_BASE}/teams/${team.id}`, { headers: auth(adminT) });
  });
});
