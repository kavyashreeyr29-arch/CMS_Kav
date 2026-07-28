// TEMPORARY — test-only quick-login list for the Login page.
// Mirrors backend/prisma/seed.ts's PEOPLE array (one representative account
// per role) purely so every permission variant is reachable with one click
// while the app is being tested. Remove this file and its usage in
// Login.tsx once real auth/SSO is wired up and manual role testing is done —
// see CHANGELOG.md 2026-07-22 and CLAUDE.md.
export interface DemoAccount {
  label: string;
  name: string;
  email: string;
  group: 'Full access' | 'Field team' | 'External';
}

export const DEMO_PASSWORD = 'password123';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', name: 'P. Manager', email: 'pmanager@elevatohub.io', group: 'Full access' },
  { label: 'Director', name: 'N. Rao', email: 'nrao@elevatohub.io', group: 'Full access' },
  { label: 'Project Manager', name: 'S. Iyer', email: 'siyer@elevatohub.io', group: 'Full access' },
  { label: 'Lead', name: 'V. Kapoor', email: 'vkapoor@elevatohub.io', group: 'Full access' },
  { label: 'Senior Developer', name: 'P. Sharma', email: 'psharma@elevatohub.io', group: 'Full access' },
  { label: 'Junior Developer', name: 'J. Ortiz', email: 'jortiz@elevatohub.io', group: 'Full access' },
  { label: 'Intern', name: 'S. Dubey', email: 'sdubey@elevatohub.io', group: 'Full access' },
  { label: 'QA', name: 'F. Haddad', email: 'fhaddad@elevatohub.io', group: 'Full access' },
  { label: 'Call Center Agent', name: 'R. Gupta', email: 'rgupta@elevatohub.io', group: 'Field team' },
  { label: 'Customer Success', name: 'K. Menon', email: 'kmenon@elevatohub.io', group: 'Field team' },
  { label: 'Operations', name: 'D. Chen', email: 'dchen@elevatohub.io', group: 'Field team' },
  { label: 'Client', name: 'A. Kapoor', email: 'akapoor@elevatohub.io', group: 'External' },
];

export const DEMO_GROUPS: DemoAccount['group'][] = ['Full access', 'Field team', 'External'];
