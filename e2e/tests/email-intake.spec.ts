import { test, expect, APIRequestContext } from '@playwright/test';
import { login, SEED_ADMIN_EMAIL } from './fixtures';

// Coverage for the email-to-ticket intake documented in CHANGELOG.md —
// POST /email-intake/inbound (backend/src/email-intake/) is a
// machine-to-machine webhook, not a UI flow, so per CLAUDE.md's "hit the
// endpoint directly" bar this uses Playwright's `request` fixture to call
// it with a real shared secret, then verifies the resulting ticket through
// the actual UI (not just the raw API response) to catch any
// frontend-display gap (e.g. an unmapped TicketSource label).
//
// EMAIL_INTAKE_SECRET must match backend/.env's dev value.
const EMAIL_INTAKE_SECRET = 'dev-email-intake-secret';
const API_BASE = 'http://localhost:3000/api/v1';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: { email: SEED_ADMIN_EMAIL, password: 'password123' } });
  return (await res.json()).accessToken;
}
function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

test.describe('Email-to-ticket intake', () => {
  test('rejects a request with no/wrong shared secret', async ({ request }) => {
    const res = await request.post(`${API_BASE}/email-intake/inbound`, {
      data: { from: 'someone@example.com', subject: 'hi', body: 'test' },
    });
    expect(res.status()).toBe(401);

    const wrongSecret = await request.post(`${API_BASE}/email-intake/inbound`, {
      headers: { Authorization: 'Bearer not-the-secret' },
      data: { from: 'someone@example.com', subject: 'hi', body: 'test' },
    });
    expect(wrongSecret.status()).toBe(401);
  });

  test('a new sender email creates a ticket, auto-provisions a Client reporter, and it shows up in the UI with an Email source chip', async ({ page, request }) => {
    const uniqueEmail = `e2e-intake-${Date.now()}@example.com`;
    const subject = `E2E inbound email ${Date.now()}`;

    const res = await request.post(`${API_BASE}/email-intake/inbound`, {
      headers: { Authorization: `Bearer ${EMAIL_INTAKE_SECRET}` },
      data: { from: uniqueEmail, subject, body: 'Please help, my account is locked.' },
    });
    expect(res.status()).toBe(201);
    const ticket = await res.json();
    expect(ticket.source).toBe('EmailInbound');
    expect(ticket.reporter.email).toBe(uniqueEmail);

    await login(page);
    await page.goto(`/tickets/${ticket.id}`);
    await expect(page.locator('.ticket-detail-main')).toContainText(subject);
    await expect(page.locator('.source-chip')).toHaveText('Email');

    // This auto-provisions a real Client user on every run (a unique
    // Date.now()-based email each time) — clean up both, or it accumulates
    // forever across regression runs (found via a screenshot showing ~50
    // "E2e Intake ..." watcher-chip candidates cluttering New ticket).
    const t = await adminToken(request);
    await request.delete(`${API_BASE}/tickets/${ticket.id}`, { headers: auth(t) });
    await request.delete(`${API_BASE}/users/${ticket.reporter.id}`, { headers: auth(t) });
  });

  test('a second email from the same sender reuses the same reporter (no duplicate user)', async ({ request }) => {
    const uniqueEmail = `e2e-intake-repeat-${Date.now()}@example.com`;

    const first = await request.post(`${API_BASE}/email-intake/inbound`, {
      headers: { Authorization: `Bearer ${EMAIL_INTAKE_SECRET}` },
      data: { from: uniqueEmail, subject: 'First contact', body: 'Issue one.' },
    });
    const second = await request.post(`${API_BASE}/email-intake/inbound`, {
      headers: { Authorization: `Bearer ${EMAIL_INTAKE_SECRET}` },
      data: { from: uniqueEmail, subject: 'Follow-up', body: 'Issue two.' },
    });
    const firstTicket = await first.json();
    const secondTicket = await second.json();
    expect(secondTicket.reporter.id).toBe(firstTicket.reporter.id);

    const t = await adminToken(request);
    await request.delete(`${API_BASE}/tickets/${firstTicket.id}`, { headers: auth(t) });
    await request.delete(`${API_BASE}/tickets/${secondTicket.id}`, { headers: auth(t) });
    await request.delete(`${API_BASE}/users/${firstTicket.reporter.id}`, { headers: auth(t) });
  });
});
