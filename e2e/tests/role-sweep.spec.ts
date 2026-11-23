import { test, expect } from '@playwright/test';

// Full role-permission sweep: for every seeded role, verify the quick-login
// lands on the right page, the sidebar shows exactly the nav items that
// role's permissions grant (no more, no less), and the page renders with no
// console/page errors. Complements the backend-focused curl sweep recorded
// in CHANGELOG.md — this catches frontend-only bugs (like a mislabeled nav
// item) that a pure API check can't see.
const ROLE_EXPECTATIONS: { button: string; landingPath: RegExp; navItems: string[] }[] = [
  {
    // "Roles & permissions" (dynamic RBAC admin screen) is gated on
    // manageRoles, true only for Admin by default — see CHANGELOG.md.
    button: 'Admin',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Analytics', 'Team hours', 'My Timesheet', 'Users & roles', 'Teams', 'Roles & permissions', 'Workflow', 'GitHub integration', 'Audit log', 'Labels', 'Business categories', 'SLA policies', 'AI integrations'],
  },
  {
    // Director gained Analytics access as part of the leadership-visibility
    // widening (see CHANGELOG.md) — Director/PM/Lead/Manager can now see
    // reporting, not just Admin.
    button: 'Director',
    landingPath: /\/dashboard$/,
    // My Timesheet is visible even without timeTracking — Director gets the
    // org-wide Team overview there, not a personal timer-based view.
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Analytics', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'Project Manager',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Analytics', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'Lead',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Team tickets', 'Board', 'Comms & tracking', 'Analytics', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'Senior Developer',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'Junior Developer',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'Intern',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'QA',
    landingPath: /\/dashboard$/,
    navItems: ['Dashboard', 'Projects', 'Tickets', 'Backlog', 'Board', 'Comms & tracking', 'Team hours', 'My Timesheet'],
  },
  {
    button: 'Call Center Agent',
    landingPath: /\/my-board$/,
    navItems: ['My tickets summary', 'Projects', 'Team tickets'],
  },
  {
    button: 'Customer Success',
    landingPath: /\/my-board$/,
    // Analytics added — CHANGELOG.md widened customersuccess.adminAnalytics
    // to true so the Campaign & promotion tickets summary panel (which they
    // need to see) is actually reachable, not just server-side permitted.
    navItems: ['My tickets summary', 'Projects', 'Team tickets', 'Board', 'Analytics'],
  },
  {
    button: 'Operations',
    landingPath: /\/my-board$/,
    navItems: ['My tickets summary', 'Team tickets'],
  },
  {
    button: 'Client',
    landingPath: /\/tickets$/,
    navItems: ['My tickets'],
  },
];

test.describe('Full role-permission sweep', () => {
  for (const { button, landingPath, navItems } of ROLE_EXPECTATIONS) {
    test(`${button}: lands correctly, sidebar shows exactly its permitted nav items, no page errors`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto('/login');
      await page.locator('.panel', { hasText: 'Quick login' }).getByRole('button', { name: button, exact: true }).click();
      await page.waitForURL(landingPath, { timeout: 15000 });

      const navLabels = await page.locator('.sidebar-nav .nav-item-label').allTextContents();
      expect(navLabels.sort()).toEqual([...navItems].sort());

      expect(pageErrors, `console errors on ${button}'s landing page: ${pageErrors.join('; ')}`).toEqual([]);
    });
  }
});
