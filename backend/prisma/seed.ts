// Seeds a demo dataset mirroring docs/prototype/pulse-dashboard.jsx so the
// real app has something to look at immediately. Run with `npm run seed`
// after `npm run prisma:push`.
import { Prisma, PrismaClient, Priority, ProjectStatus, TicketSource, TicketStatus, TicketType, TimeEntrySource } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLE_SEED = [
  { id: 'admin', key: 'admin', label: 'Admin', group: 'Full access', defaultScope: 'all' },
  { id: 'director', key: 'director', label: 'Director', group: 'Full access', defaultScope: 'all' },
  { id: 'pm', key: 'pm', label: 'Project Manager', group: 'Full access', defaultScope: 'all' },
  { id: 'lead', key: 'lead', label: 'Lead', group: 'Full access', defaultScope: 'all' },
  { id: 'senior_developer', key: 'senior_developer', label: 'Senior Developer', group: 'Full access', defaultScope: 'all' },
  { id: 'junior_developer', key: 'junior_developer', label: 'Junior Developer', group: 'Full access', defaultScope: 'all' },
  { id: 'intern', key: 'intern', label: 'Intern', group: 'Full access', defaultScope: 'all' },
  { id: 'qa', key: 'qa', label: 'QA', group: 'Full access', defaultScope: 'all' },
  { id: 'callcenter', key: 'callcenter', label: 'Call Center Agent', group: 'Field team', defaultScope: 'source' },
  { id: 'customersuccess', key: 'customersuccess', label: 'Customer Success', group: 'Field team', defaultScope: 'source' },
  { id: 'operations', key: 'operations', label: 'Operations', group: 'Field team', defaultScope: 'source' },
  { id: 'client', key: 'client', label: 'Client', group: 'External', defaultScope: 'reporter' },
];

// Covers all 12 roles in ROLE_SEED so every permission variant has a real
// login (backend/src/common/permissions/role-permissions.ts ROLE_IDS) — the
// frontend's temporary quick-login panel (frontend/src/pages/Login.tsx) reads
// from this same shape, so keep the two in sync until that panel is removed.
const PEOPLE: { name: string; roleId: string; seniority?: string }[] = [
  { name: 'P. Manager', roleId: 'admin' },
  { name: 'N. Rao', roleId: 'director' },
  { name: 'S. Iyer', roleId: 'pm', seniority: 'manager' },
  { name: 'A. Fernandes', roleId: 'pm', seniority: 'manager' },
  { name: 'V. Kapoor', roleId: 'lead', seniority: 'lead' },
  { name: 'P. Sharma', roleId: 'senior_developer', seniority: 'senior_developer' },
  { name: 'M. Thomas', roleId: 'senior_developer', seniority: 'senior_developer' },
  { name: 'J. Ortiz', roleId: 'junior_developer', seniority: 'junior_developer' },
  { name: 'S. Dubey', roleId: 'intern', seniority: 'intern' },
  { name: 'F. Haddad', roleId: 'qa', seniority: 'qa' },
  { name: 'R. Gupta', roleId: 'callcenter' },
  { name: 'K. Menon', roleId: 'customersuccess' },
  { name: 'D. Chen', roleId: 'operations' },
  { name: 'L. Okafor', roleId: 'customersuccess' },
  { name: 'J. Silva', roleId: 'callcenter' },
  { name: 'T. Novak', roleId: 'operations' },
  { name: 'A. Kapoor', roleId: 'client' },
];

// A team for the Lead demo account to lead (backend/prisma/schema.prisma's
// Team model + scope:'team' filtering — the seed previously created zero
// Team rows at all, so the Lead role always saw an empty dashboard and
// GET /reports/work-hours 500'd on an empty IN() clause; see CHANGELOG).
const TEAM = { name: 'Delivery Squad', lead: 'V. Kapoor', members: ['V. Kapoor', 'P. Sharma', 'J. Ortiz', 'F. Haddad'] };

// One project per SDLC phase (bar RequirementAnalysis/OnHold, covered by
// the docs/notes narrative below instead) so the demo shows every stage
// somewhere rather than everything sitting in one default status.
const PROJECTS = [
  { code: 'ATLAS', name: 'Atlas — Core Platform', client: 'Internal', priority: Priority.High, pm: 'S. Iyer', team: TEAM.name, status: ProjectStatus.Implementation },
  { code: 'ORION', name: 'Orion — Mobile Banking', client: 'Meridian Bank', priority: Priority.Critical, pm: 'A. Fernandes', status: ProjectStatus.Testing },
  { code: 'NOVA', name: 'Nova — Client Portal', client: 'Kestrel Retail', priority: Priority.Medium, pm: 'S. Iyer', status: ProjectStatus.Design },
  { code: 'HELIX', name: 'Helix — Data Platform', client: 'Internal', priority: Priority.High, pm: 'A. Fernandes', status: ProjectStatus.Deployment },
  { code: 'ZEN', name: 'Zen — Support Desk', client: 'Vantage Health', priority: Priority.Medium, pm: 'S. Iyer', status: ProjectStatus.Maintenance },
];

const LABELS = [
  'Login Issue', 'Redemption Issue', 'Coupon Issue', 'Payment Issue', 'Account Access',
  'Delivery Delay', 'App Crash', 'Refund Request', 'Data Sync Issue', 'General Query',
];

const TICKET_TITLES = [
  'Login fails on token refresh', 'Add export to CSV on report screen',
  'Improve dashboard load time', 'Client requests SSO integration',
  'Fix pagination on tickets table', 'Coupon not applying at checkout',
  'Redemption points not credited', 'Mobile layout breaks on iPad',
  'Search results missing recent items', 'Timezone off by one hour in reports',
  'Bulk upload fails on large files', 'Notification email formatting broken',
];

// Three Epics per project, each at a different stage of the
// requirement-to-deployment pipeline (Backlog's "Roadmap" summary,
// docs/prd-phase2.md §2.3) — one finished, one actively underway, one not
// yet started — so the roadmap actually shows a spread instead of every
// Epic sitting in "Planning" forever.
const EPICS = [
  { title: 'Reporting & analytics overhaul', status: TicketStatus.Completed, createdDaysAgo: 170, updatedDaysAgo: 40 },
  { title: 'Onboarding revamp', status: TicketStatus.InProgress, createdDaysAgo: 90, updatedDaysAgo: 3 },
  { title: 'Mobile experience refresh', status: TicketStatus.Open, createdDaysAgo: 20, updatedDaysAgo: 20 },
] as const;

// Three Stories per Epic, statuses chosen so each Epic's completion
// percentage/progress bar and stage-chip breakdown tell a coherent story:
// Epic 0 fully done, Epic 1 partway through every stage, Epic 2 untouched.
const STORIES = [
  // Epic 0 — Reporting & analytics overhaul (done)
  { epic: 0, title: 'Add analytics event tracking', status: TicketStatus.Completed, createdDaysAgo: 150, updatedDaysAgo: 35 },
  { epic: 0, title: 'Build export-to-PDF for reports', status: TicketStatus.Completed, createdDaysAgo: 130, updatedDaysAgo: 28 },
  { epic: 0, title: 'Add scheduled report emails', status: TicketStatus.Completed, createdDaysAgo: 110, updatedDaysAgo: 20 },
  // Epic 1 — Onboarding revamp (in progress)
  { epic: 1, title: 'Design new onboarding flow', status: TicketStatus.Completed, createdDaysAgo: 80, updatedDaysAgo: 15 },
  { epic: 1, title: 'Wire up email verification step', status: TicketStatus.InProgress, createdDaysAgo: 40, updatedDaysAgo: 3 },
  { epic: 1, title: 'Add progress-save for multi-step signup', status: TicketStatus.QATesting, createdDaysAgo: 28, updatedDaysAgo: 2 },
  // Epic 2 — Mobile experience refresh (not started)
  { epic: 2, title: 'Audit mobile layout breakpoints', status: TicketStatus.Open, createdDaysAgo: 8, updatedDaysAgo: 8 },
  { epic: 2, title: 'Redesign mobile navigation', status: TicketStatus.Open, createdDaysAgo: 5, updatedDaysAgo: 5 },
  { epic: 2, title: 'Add offline mode support', status: TicketStatus.Open, createdDaysAgo: 2, updatedDaysAgo: 2 },
] as const;

// A couple of comments on the Stories actually being worked
// (InProgress/QATesting) so ticket detail pages and the Comms & tracking
// activity feed have real conversation, not just system-generated entries.
const STORY_COMMENTS: Record<string, string[]> = {
  'Wire up email verification step': [
    'Backend endpoint is done, wiring up the frontend form now.',
    'Found an edge case with disposable email domains — filing a follow-up, shouldn\'t block this.',
  ],
  'Add progress-save for multi-step signup': [
    'Moved to QA — regression pass covers all 4 signup steps plus browser-back handling.',
  ],
};

// Cycled across every seeded ticket so all four source-scoped roles
// (Call Center, Customer Success, Operations, Client) have something to see
// — a flat CallCenter/CustomerSuccess split previously meant Operations and
// Client always landed on an empty list, indistinguishable from a bug.
const SOURCE_CYCLE: { source: TicketSource; reporter: string }[] = [
  { source: TicketSource.CallCenter, reporter: 'R. Gupta' },
  { source: TicketSource.CustomerSuccess, reporter: 'K. Menon' },
  { source: TicketSource.Operations, reporter: 'D. Chen' },
  { source: TicketSource.ClientPortal, reporter: 'A. Kapoor' },
];

// docs/prd-phase2.md §2.4/§13 — cycled across every ticket (harmless for
// roles it isn't compulsory for) so the Business Category analytics panel
// has real, varied data instead of one giant "Uncategorized" bucket.
// Was a fixed Prisma enum — now rows in the admin-manageable BusinessCategory
// table (seeded just below in main()), matched to tickets by plain string.
const BUSINESS_CATEGORY_CYCLE = ['InnovateX', 'ElevatozX', 'AccquareX'];

// docs/prd-phase2.md §13 — spread ticket creation across ~5.5 months so the
// month/quarter/year Trend panel and the Analytics productivity window have
// real variation instead of everything clustering on "today".
const CREATED_DAYS_AGO = [2, 4, 7, 9, 13, 18, 22, 28, 35, 42, 50, 60, 75, 95, 120, 150];
// Idle days (time since last touched) for still-open tickets — capped by the
// ticket's own age below. Deliberately spans every ageing bucket
// (0-2d / 3-5d / 6-10d / 11-20d / 21d+) so the Dashboard heatmap isn't flat.
const IDLE_DAYS_AGO = [0, 1, 3, 4, 7, 9, 14, 18, 25, 30];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  const org = await prisma.org.upsert({
    where: { id: 'seed-org' },
    update: {},
    create: { id: 'seed-org', name: 'ElevatoHub Demo Org' },
  });

  // Deterministic re-seed (same philosophy as the ticket wipe below): reset
  // `permissionsJson` to null on every run so the 12 built-in roles always
  // come back to their hardcoded defaults (role-permissions.ts), even if an
  // admin (or a stray test run) edited one via the Roles & Permissions
  // screen. Custom roles an admin created aren't in ROLE_SEED at all, so
  // this loop never touches them.
  for (const role of ROLE_SEED) {
    await prisma.role.upsert({ where: { id: role.id }, update: { ...role, permissionsJson: Prisma.JsonNull }, create: role });
  }

  const passwordHash = await bcrypt.hash('password123', 12);
  const userByName = new Map<string, string>();
  for (const person of PEOPLE) {
    const email = `${person.name.toLowerCase().replace(/[^a-z]/g, '')}@elevatohub.io`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        orgId: org.id,
        name: person.name,
        email,
        passwordHash,
        baseRoleId: person.roleId,
        seniority: person.seniority as never,
        avatarInitials: person.name.split(' ').map((s) => s[0]).join('').replace('.', '').slice(0, 2).toUpperCase(),
      },
    });
    userByName.set(person.name, user.id);
  }

  const team = await prisma.team.upsert({
    where: { id: 'seed-team-delivery-squad' },
    update: { leadUserId: userByName.get(TEAM.lead)! },
    create: { id: 'seed-team-delivery-squad', name: TEAM.name, leadUserId: userByName.get(TEAM.lead)! },
  });
  for (const memberName of TEAM.members) {
    const userId = userByName.get(memberName)!;
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId, teamId: team.id } },
      update: {},
      create: { userId, teamId: team.id },
    });
  }

  for (const label of LABELS) {
    await prisma.label.upsert({
      where: { orgId_name: { orgId: org.id, name: label } },
      update: {},
      create: { orgId: org.id, name: label, createdBy: userByName.get('P. Manager')! },
    });
  }
  const labelIds = await prisma.label.findMany({ where: { orgId: org.id } });

  // Admin-manageable Business Category list (CHANGELOG.md) — was a fixed
  // Prisma enum, now seeded rows so the demo data still has the same three
  // categories, but an admin can add/retire more from the UI.
  for (const category of BUSINESS_CATEGORY_CYCLE) {
    await prisma.businessCategory.upsert({
      where: { orgId_name: { orgId: org.id, name: category } },
      update: {},
      create: { orgId: org.id, name: category, createdBy: userByName.get('P. Manager')! },
    });
  }

  // Collected while seeding so the time-entry pass below can log against a
  // real spread of tickets across every project without a second query.
  const seededTicketIds: { projectCode: string; id: string; status: TicketStatus }[] = [];

  for (const proj of PROJECTS) {
    const project = await prisma.project.upsert({
      where: { code: proj.code },
      update: { teamId: proj.team ? team.id : null, status: proj.status },
      create: {
        code: proj.code,
        name: proj.name,
        client: proj.client,
        pmUserId: userByName.get(proj.pm)!,
        teamId: proj.team ? team.id : null,
        status: proj.status,
        priority: proj.priority,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-09-30'),
        description: `${proj.name} — seeded demo project.`,
      },
    });

    // Deterministic re-seed: always start each seeded project's tickets from
    // a clean slate rather than skipping when *any* tickets exist. The old
    // "skip if count > 0" guard meant a schema/logic improvement here (like
    // the source-cycle fix above) silently never applied to an
    // already-seeded database — worse than just being slow to re-run.
    await prisma.ticket.deleteMany({ where: { projectId: project.id } });
    await prisma.project.update({ where: { id: project.id }, data: { ticketSeq: 1000 } });

    // Three Epics per project (docs/prd-phase2.md §2.3 — Backlog groups
    // Stories under these), created oldest-first so they read as genuinely
    // "planned ahead of" their Stories, and at three different pipeline
    // stages so Backlog's Roadmap summary shows a real spread.
    const epicIds: string[] = [];
    for (let e = 0; e < EPICS.length; e++) {
      const cfg = EPICS[e];
      const seq = await prisma.project.update({ where: { id: project.id }, data: { ticketSeq: { increment: 1 } } });
      const epic = await prisma.ticket.create({
        data: {
          displayId: `${proj.code}-${seq.ticketSeq}`,
          projectId: project.id,
          title: cfg.title,
          description: 'Seeded demo epic — groups the related Stories below in Backlog.',
          type: TicketType.Epic,
          priority: Priority.Medium,
          status: cfg.status,
          source: TicketSource.InternalPM,
          businessCategory: BUSINESS_CATEGORY_CYCLE[e % BUSINESS_CATEGORY_CYCLE.length],
          labelId: labelIds[e % labelIds.length].id,
          reporterUserId: userByName.get(proj.pm)!,
          startDate: daysAgo(cfg.createdDaysAgo),
          createdAt: daysAgo(cfg.createdDaysAgo),
          updatedAt: daysAgo(cfg.updatedDaysAgo),
        },
      });
      epicIds.push(epic.id);
      seededTicketIds.push({ projectCode: proj.code, id: epic.id, status: epic.status });
    }

    // Three Stories under each Epic above, at whatever stage tells that
    // Epic's progress story (see the STORIES table's comments) — plus a
    // couple of watchers and comments on the ones actually in flight so
    // ticket detail pages have real activity, not just an empty shell.
    const devTeam = ['P. Sharma', 'M. Thomas', 'J. Ortiz', 'S. Dubey', 'F. Haddad'];
    for (let s = 0; s < STORIES.length; s++) {
      const cfg = STORIES[s];
      const seq = await prisma.project.update({ where: { id: project.id }, data: { ticketSeq: { increment: 1 } } });
      const inFlight = cfg.status === TicketStatus.InProgress || cfg.status === TicketStatus.QATesting;
      const story = await prisma.ticket.create({
        data: {
          displayId: `${proj.code}-${seq.ticketSeq}`,
          projectId: project.id,
          parentTicketId: epicIds[cfg.epic],
          title: cfg.title,
          description: 'Seeded demo story — steps to reproduce, expected vs actual behaviour go here.',
          type: TicketType.Story,
          priority: s % 2 === 0 ? Priority.High : Priority.Medium,
          status: cfg.status,
          source: TicketSource.InternalPM,
          businessCategory: BUSINESS_CATEGORY_CYCLE[s % BUSINESS_CATEGORY_CYCLE.length],
          labelId: labelIds[s % labelIds.length].id,
          reporterUserId: userByName.get(proj.pm)!,
          assigneeUserId: [...userByName.values()][s % userByName.size],
          // Deployed/in-review work already has a due date behind it;
          // untouched Planning-stage stories default 2 weeks out.
          watcherUserIds: inFlight ? [userByName.get(devTeam[(s + 1) % devTeam.length])!] : [],
          startDate: daysAgo(cfg.createdDaysAgo),
          dueDate: cfg.status === TicketStatus.Completed
            ? daysAgo(cfg.updatedDaysAgo)
            : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          createdAt: daysAgo(cfg.createdDaysAgo),
          updatedAt: daysAgo(cfg.updatedDaysAgo),
        },
      });
      seededTicketIds.push({ projectCode: proj.code, id: story.id, status: story.status });

      const comments = STORY_COMMENTS[cfg.title];
      if (comments) {
        for (let c = 0; c < comments.length; c++) {
          await prisma.ticketComment.create({
            data: {
              ticketId: story.id,
              authorUserId: [...userByName.values()][(s + c) % userByName.size],
              body: comments[c],
              createdAt: daysAgo(Math.max(0, cfg.updatedDaysAgo - c)),
            },
          });
        }
      }
    }

    for (let i = 0; i < 12; i++) {
      const seq = await prisma.project.update({
        where: { id: project.id },
        data: { ticketSeq: { increment: 1 } },
      });
      const { source, reporter } = SOURCE_CYCLE[i % SOURCE_CYCLE.length];
      const assignee = [...userByName.values()][i % userByName.size];
      const status = i % 5 === 0 ? TicketStatus.Completed : i % 3 === 0 ? TicketStatus.InProgress : TicketStatus.Open;
      const createdDaysAgo = CREATED_DAYS_AGO[i % CREATED_DAYS_AGO.length];
      const createdAt = daysAgo(createdDaysAgo);
      // Closed/completed tickets were "last touched" on some day between
      // creation and now (their resolution); still-open ones use the
      // dedicated idle spread so the ageing heatmap shows real variety.
      const updatedAt = status === TicketStatus.Completed
        ? daysAgo(Math.max(0, Math.floor(createdDaysAgo / 2)))
        : daysAgo(Math.min(createdDaysAgo, IDLE_DAYS_AGO[(i + 3) % IDLE_DAYS_AGO.length]));

      const ticket = await prisma.ticket.create({
        data: {
          displayId: `${proj.code}-${seq.ticketSeq}`,
          projectId: project.id,
          title: TICKET_TITLES[i % TICKET_TITLES.length],
          description: 'Seeded demo ticket — steps to reproduce, expected vs actual behaviour go here.',
          type: i % 4 === 0 ? TicketType.Bug : TicketType.Task,
          priority: i % 4 === 0 ? Priority.Critical : Priority.Medium,
          status,
          source,
          businessCategory: BUSINESS_CATEGORY_CYCLE[i % BUSINESS_CATEGORY_CYCLE.length],
          labelId: labelIds[i % labelIds.length].id,
          reporterUserId: userByName.get(reporter)!,
          assigneeUserId: assignee,
          startDate: createdAt,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt,
          updatedAt,
        },
      });
      seededTicketIds.push({ projectCode: proj.code, id: ticket.id, status: ticket.status });
    }
  }

  // Pre-development approval pipeline demo data (CHANGELOG.md) — a handful
  // of governance-type (ChangeRequest/Feature) tickets sitting at each
  // intake stage, most carrying real ApprovalRequest history (approved,
  // pending, rejected, and changes-requested examples), so the feature shows
  // real state the first time someone looks at it instead of an empty board
  // column and an empty Approvals panel.
  await prisma.approvalRequest.deleteMany({
    where: { ticket: { project: { code: { in: PROJECTS.map((p) => p.code) } } } },
  });
  await prisma.ticket.deleteMany({
    where: { project: { code: { in: PROJECTS.map((p) => p.code) } }, type: { in: [TicketType.ChangeRequest, TicketType.Feature] } },
  });

  interface GovernanceApprovalCfg {
    label: string;
    requestedBy: string;
    approver: string;
    decision: 'pending' | 'approved' | 'rejected' | 'changes_requested';
    note?: string;
    comment?: string;
    requestedDaysAgo: number;
    decidedDaysAgo?: number;
  }
  interface GovernanceTicketCfg {
    projectCode: string;
    title: string;
    type: TicketType;
    status: TicketStatus;
    reporter: string;
    createdDaysAgo: number;
    approvals: GovernanceApprovalCfg[];
    // Deliberately independent of `approvals[].approver` — the assignee does
    // the work, the approver signs off on a specific ApprovalRequest, and
    // they're very often different people. A couple of entries below set
    // this to make that concrete rather than leaving every demo ticket
    // "Unassigned".
    assignee?: string;
  }

  const GOVERNANCE_TICKETS: GovernanceTicketCfg[] = [
    {
      projectCode: 'ATLAS', title: 'Add SSO login for enterprise clients', type: TicketType.Feature,
      status: TicketStatus.RequirementGathering, reporter: 'S. Iyer', createdDaysAgo: 2, approvals: [],
    },
    {
      projectCode: 'ATLAS', title: 'Integrate new payment gateway', type: TicketType.ChangeRequest,
      status: TicketStatus.CommercialApproval, reporter: 'S. Iyer', createdDaysAgo: 5,
      // Assigned to the developer who'll build the integration, while the
      // Director (a different person) is the one who signed off on the
      // commercial terms — assignment and approval are separate axes.
      assignee: 'P. Sharma',
      approvals: [
        { label: 'Commercial Approval', requestedBy: 'S. Iyer', approver: 'N. Rao', decision: 'approved', note: 'Vendor quote attached — needs sign-off before we scope it.', requestedDaysAgo: 4, decidedDaysAgo: 3 },
      ],
    },
    {
      projectCode: 'ORION', title: 'Launch new rewards tier for premium customers', type: TicketType.Feature,
      status: TicketStatus.RequirementApproval, reporter: 'A. Fernandes', createdDaysAgo: 8,
      approvals: [
        { label: 'Commercial Approval', requestedBy: 'A. Fernandes', approver: 'N. Rao', decision: 'approved', requestedDaysAgo: 7, decidedDaysAgo: 6 },
        { label: 'Requirement Approval', requestedBy: 'A. Fernandes', approver: 'N. Rao', decision: 'pending', note: 'Please confirm scope covers both iOS and Android.', requestedDaysAgo: 1 },
      ],
    },
    {
      projectCode: 'HELIX', title: 'Migrate reporting pipeline to new data warehouse', type: TicketType.ChangeRequest,
      status: TicketStatus.ManagerApproval, reporter: 'A. Fernandes', createdDaysAgo: 12,
      // Already assigned and doing prep work even though the Manager's
      // Approval below is still pending — the dev doesn't need to wait for
      // sign-off to be assigned, only to move past the ManagerApproval gate.
      assignee: 'M. Thomas',
      approvals: [
        { label: 'Commercial Approval', requestedBy: 'A. Fernandes', approver: 'N. Rao', decision: 'approved', requestedDaysAgo: 10, decidedDaysAgo: 9 },
        { label: 'Requirement Approval', requestedBy: 'A. Fernandes', approver: 'N. Rao', decision: 'approved', requestedDaysAgo: 7, decidedDaysAgo: 6 },
        { label: "Manager's Approval", requestedBy: 'A. Fernandes', approver: 'P. Manager', decision: 'pending', requestedDaysAgo: 2 },
      ],
    },
    {
      projectCode: 'ZEN', title: 'Expand support desk to cover EU business hours', type: TicketType.ChangeRequest,
      status: TicketStatus.CommercialApproval, reporter: 'S. Iyer', createdDaysAgo: 6,
      approvals: [
        { label: 'Commercial Approval', requestedBy: 'S. Iyer', approver: 'N. Rao', decision: 'changes_requested', comment: "Budget doesn't account for after-hours on-call pay — please revise and resend.", requestedDaysAgo: 3, decidedDaysAgo: 2 },
      ],
    },
    {
      projectCode: 'NOVA', title: 'Add self-serve invoice download for clients', type: TicketType.Feature,
      status: TicketStatus.RequirementGathering, reporter: 'S. Iyer', createdDaysAgo: 15,
      approvals: [
        { label: 'Commercial Approval', requestedBy: 'S. Iyer', approver: 'N. Rao', decision: 'rejected', comment: "Not a priority this quarter — revisit after the portal redesign ships.", requestedDaysAgo: 12, decidedDaysAgo: 11 },
      ],
    },
  ];

  for (const cfg of GOVERNANCE_TICKETS) {
    const project = await prisma.project.findUnique({ where: { code: cfg.projectCode } });
    if (!project) continue;
    const seq = await prisma.project.update({ where: { id: project.id }, data: { ticketSeq: { increment: 1 } } });
    const ticket = await prisma.ticket.create({
      data: {
        displayId: `${cfg.projectCode}-${seq.ticketSeq}`,
        projectId: project.id,
        title: cfg.title,
        description: 'Seeded demo governance ticket — see the Approvals panel for its sign-off history.',
        type: cfg.type,
        priority: Priority.High,
        status: cfg.status,
        source: TicketSource.InternalPM,
        businessCategory: BUSINESS_CATEGORY_CYCLE[0],
        reporterUserId: userByName.get(cfg.reporter)!,
        assigneeUserId: cfg.assignee ? userByName.get(cfg.assignee) : undefined,
        createdAt: daysAgo(cfg.createdDaysAgo),
        updatedAt: daysAgo(cfg.approvals[0]?.decidedDaysAgo ?? cfg.createdDaysAgo),
      },
    });
    for (const a of cfg.approvals) {
      await prisma.approvalRequest.create({
        data: {
          ticketId: ticket.id,
          label: a.label,
          requestedByUserId: userByName.get(a.requestedBy)!,
          approverUserId: userByName.get(a.approver)!,
          decision: a.decision,
          requestNote: a.note,
          decisionComment: a.comment,
          decidedByUserId: a.decision === 'pending' ? null : userByName.get(a.approver)!,
          createdAt: daysAgo(a.requestedDaysAgo),
          decidedAt: a.decidedDaysAgo !== undefined ? daysAgo(a.decidedDaysAgo) : null,
        },
      });
    }
  }

  // Campaigns/Rewards/Communication/To-do demo data (CHANGELOG.md
  // "Basecamp-style project folders") — enough on a couple of projects to
  // show each tab populated rather than every project's folders empty.
  const atlasProject = await prisma.project.findUnique({ where: { code: 'ATLAS' } });
  const orionProject = await prisma.project.findUnique({ where: { code: 'ORION' } });
  const zenProject = await prisma.project.findUnique({ where: { code: 'ZEN' } });

  await prisma.campaign.deleteMany({ where: { project: { code: { in: PROJECTS.map((p) => p.code) } } } });
  await prisma.reward.deleteMany({ where: { project: { code: { in: PROJECTS.map((p) => p.code) } } } });
  await prisma.projectNote.deleteMany({ where: { project: { code: { in: PROJECTS.map((p) => p.code) } } } });
  await prisma.projectTodoItem.deleteMany({ where: { project: { code: { in: PROJECTS.map((p) => p.code) } } } });

  if (atlasProject) {
    const campaign = await prisma.campaign.create({
      data: {
        projectId: atlasProject.id,
        name: 'Q3 Enterprise Upsell Push',
        description: 'Bundled SSO + payment-gateway work into one pitch for existing enterprise accounts.',
        status: 'Active',
        startDate: daysAgo(20),
        endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        createdByUserId: userByName.get('S. Iyer')!,
      },
    });
    const linkable = await prisma.ticket.findFirst({ where: { projectId: atlasProject.id, title: 'Integrate new payment gateway' } });
    if (linkable) await prisma.ticket.update({ where: { id: linkable.id }, data: { campaignId: campaign.id } });

    await prisma.projectNote.createMany({
      data: [
        { projectId: atlasProject.id, authorUserId: userByName.get('S. Iyer')!, body: 'Kickoff call with the enterprise sales team went well — they want SSO prioritized ahead of the payment gateway work.', createdAt: daysAgo(6) },
        { projectId: atlasProject.id, authorUserId: userByName.get('P. Sharma')!, body: 'Heads up — the payment gateway vendor sandbox is down intermittently this week, may slip our estimate.', createdAt: daysAgo(2) },
      ],
    });
    await prisma.projectTodoItem.createMany({
      data: [
        { projectId: atlasProject.id, title: 'Confirm SSO provider (Okta vs Azure AD) with enterprise sales', assigneeUserId: userByName.get('S. Iyer'), createdByUserId: userByName.get('S. Iyer')!, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
        { projectId: atlasProject.id, title: 'Draft the commercial approval request for the payment gateway vendor', done: true, assigneeUserId: userByName.get('S. Iyer'), createdByUserId: userByName.get('S. Iyer')!, completedAt: daysAgo(4) },
      ],
    });
  }

  if (orionProject) {
    await prisma.reward.create({
      data: {
        projectId: orionProject.id,
        name: 'Premium Tier Cashback Bonus',
        description: '2x points multiplier for the first 90 days after upgrading to the premium tier.',
        rewardType: 'Points multiplier',
        value: 2.0,
        createdByUserId: userByName.get('A. Fernandes')!,
      },
    });
    await prisma.projectNote.create({
      data: { projectId: orionProject.id, authorUserId: userByName.get('A. Fernandes')!, body: 'Meridian Bank confirmed the rewards tier is their top ask for this quarter — treating it as our lead priority once requirement sign-off lands.', createdAt: daysAgo(3) },
    });
  }

  if (zenProject) {
    await prisma.projectTodoItem.create({
      data: { projectId: zenProject.id, title: 'Get quotes from two staffing agencies for EU after-hours coverage', assigneeUserId: userByName.get('S. Iyer'), createdByUserId: userByName.get('S. Iyer')! },
    });
  }

  // prd.md §9 — SLA policies page was entirely empty on a fresh seed (no
  // policy of any kind existed until an admin manually created one, or an
  // e2e test run happened to leave leftovers behind) despite the SLA-badge
  // UI, the CreateTicketModal expected-response note, and the breach-sweep
  // cron all assuming policies exist. Org-wide by priority, plus one
  // project-specific override (ORION's client is on a tighter contract) and
  // one client-name-scoped policy, so the SLA policies list shows every
  // scope variant the feature actually supports.
  const admin = userByName.get('P. Manager')!;
  await prisma.slaPolicy.deleteMany({ where: { orgId: org.id } });
  const orion = await prisma.project.findUnique({ where: { code: 'ORION' } });
  const SLA_POLICIES = [
    { priority: Priority.Critical, firstResponseTargetMinutes: 30, resolutionTargetMinutes: 240 },
    { priority: Priority.High, firstResponseTargetMinutes: 60, resolutionTargetMinutes: 480 },
    { priority: Priority.Medium, firstResponseTargetMinutes: 240, resolutionTargetMinutes: 1440 },
    { priority: Priority.Low, firstResponseTargetMinutes: 480, resolutionTargetMinutes: 4320 },
    ...(orion ? [{ priority: Priority.Critical, projectId: orion.id, firstResponseTargetMinutes: 15, resolutionTargetMinutes: 120 }] : []),
    { priority: null, clientName: 'Meridian Bank', firstResponseTargetMinutes: 60, resolutionTargetMinutes: 720 },
  ];
  for (const policy of SLA_POLICIES) {
    await prisma.slaPolicy.create({
      data: { orgId: org.id, createdBy: admin, updatedBy: admin, ...policy },
    });
  }

  // Time entries spread across the last ~45 days and across several
  // developers/tickets/projects — powers the Team Hours panel (history, not
  // just "today"), the Analytics productivity table (per-developer hours +
  // ticket counts), and the project-wise hours-spent column. Includes one
  // deliberately-short entry to demonstrate sub-minute timer precision
  // (docs/prd-phase2.md §5) surviving into seed data, not just live testing.
  const LOGGERS = ['P. Sharma', 'J. Ortiz', 'M. Thomas', 'F. Haddad', 'S. Dubey'];
  const LOG_DAYS_AGO = [0, 1, 2, 4, 6, 9, 13, 18, 24, 30, 38, 44];
  const LOG_DURATIONS_MIN = [15, 30, 45, 60, 90, 120, 150, 0.75];
  let loggerCursor = 0;
  let durationCursor = 0;
  for (let t = 0; t < seededTicketIds.length; t += 3) {
    const target = seededTicketIds[t];
    for (let pass = 0; pass < 2; pass++) {
      const loggerName = LOGGERS[loggerCursor % LOGGERS.length];
      loggerCursor++;
      const userId = userByName.get(loggerName)!;
      const alreadyLogged = await prisma.timeEntry.findFirst({ where: { userId, ticketId: target.id } });
      if (alreadyLogged) continue;

      const daysBack = LOG_DAYS_AGO[(t + pass) % LOG_DAYS_AGO.length];
      const durationMinutes = LOG_DURATIONS_MIN[durationCursor % LOG_DURATIONS_MIN.length];
      durationCursor++;
      const startedAt = daysAgo(daysBack);
      const endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
      await prisma.timeEntry.create({
        data: { ticketId: target.id, userId, startedAt, endedAt, durationMinutes },
      });
    }
  }

  // A couple of *today's* entries too, so the Team Hours panel's default
  // (current-day) view is never empty on a freshly seeded database.
  const atlas = await prisma.project.findUnique({ where: { code: 'ATLAS' } });
  const atlasTicket = atlas ? await prisma.ticket.findFirst({ where: { projectId: atlas.id } }) : null;
  if (atlasTicket) {
    for (const memberName of ['P. Sharma', 'J. Ortiz']) {
      const userId = userByName.get(memberName)!;
      const alreadyLogged = await prisma.timeEntry.findFirst({
        where: { userId, ticketId: atlasTicket.id, startedAt: { gte: daysAgo(1) } },
      });
      if (alreadyLogged) continue;
      const startedAt = new Date();
      startedAt.setHours(startedAt.getHours() - 3);
      const endedAt = new Date();
      endedAt.setHours(endedAt.getHours() - 1);
      await prisma.timeEntry.create({
        data: { ticketId: atlasTicket.id, userId, startedAt, endedAt, durationMinutes: 120 },
      });
    }
  }

  // My Timesheet (CHANGELOG.md) — a few manual entries so the "Manual
  // entries" section isn't empty on a fresh seed: one tied to a real ticket
  // (echoing its title, as the UI does when you pick a ticket in the form),
  // one standalone (a meeting, no ticket at all).
  await prisma.timeEntry.deleteMany({ where: { source: TimeEntrySource.manual } });
  const helixProjectForManual = await prisma.project.findUnique({ where: { code: 'HELIX' } });
  const helixTicketForManual = helixProjectForManual
    ? await prisma.ticket.findFirst({ where: { projectId: helixProjectForManual.id } })
    : null;
  const psharma = userByName.get('P. Sharma')!;
  const manualEntries: { daysAgo: number; fromHour: number; toHour: number; taskName: string; ticketId?: string }[] = [
    { daysAgo: 1, fromHour: 9, toHour: 9.5, taskName: 'Daily standup', ticketId: undefined },
    ...(helixTicketForManual
      ? [{ daysAgo: 2, fromHour: 15, toHour: 17, taskName: helixTicketForManual.title, ticketId: helixTicketForManual.id }]
      : []),
    { daysAgo: 5, fromHour: 14, toHour: 15, taskName: 'Sprint planning', ticketId: undefined },
  ];
  for (const m of manualEntries) {
    const day = daysAgo(m.daysAgo);
    const startedAt = new Date(day); startedAt.setHours(Math.floor(m.fromHour), (m.fromHour % 1) * 60, 0, 0);
    const endedAt = new Date(day); endedAt.setHours(Math.floor(m.toHour), (m.toHour % 1) * 60, 0, 0);
    const durationMinutes = Math.round(((endedAt.getTime() - startedAt.getTime()) / 60000) * 100) / 100;
    await prisma.timeEntry.create({
      data: {
        ticketId: m.ticketId, userId: psharma, startedAt, endedAt, durationMinutes,
        source: TimeEntrySource.manual, taskName: m.taskName,
      },
    });
  }

  // Ticket linking (CHANGELOG.md) — a sub-task hierarchy on a real ticket
  // (sub-tasks work on any ticket type now, not just the Epic/Story pairing
  // seeded above) and a comment referencing another ticket by displayId, so
  // "Add sub-task"/"Convert to standalone" and comment auto-linking both
  // show real data on a fresh seed instead of an empty state.
  await prisma.ticket.deleteMany({ where: { title: { in: ['Draft integration test plan', 'Coordinate vendor sandbox access'] } } });
  await prisma.ticketComment.deleteMany({ where: { body: { contains: 'blocked on the SSO rollout' } } });
  const paymentGatewayTicket = atlasProject
    ? await prisma.ticket.findFirst({ where: { projectId: atlasProject.id, title: 'Integrate new payment gateway' } })
    : null;
  const ssoTicket = atlasProject
    ? await prisma.ticket.findFirst({ where: { projectId: atlasProject.id, title: 'Add SSO login for enterprise clients' } })
    : null;
  if (paymentGatewayTicket && atlasProject) {
    for (const subtitle of ['Draft integration test plan', 'Coordinate vendor sandbox access']) {
      const seq = await prisma.project.update({ where: { id: atlasProject.id }, data: { ticketSeq: { increment: 1 } } });
      await prisma.ticket.create({
        data: {
          displayId: `${atlasProject.code}-${seq.ticketSeq}`,
          projectId: atlasProject.id,
          parentTicketId: paymentGatewayTicket.id,
          title: subtitle,
          description: 'Seeded demo sub-task — see the parent ticket for the full payment-gateway context.',
          type: TicketType.Task,
          priority: Priority.Medium,
          status: TicketStatus.Open,
          source: TicketSource.InternalPM,
          reporterUserId: userByName.get('P. Sharma')!,
          assigneeUserId: userByName.get('P. Sharma')!,
        },
      });
    }
    if (ssoTicket) {
      await prisma.ticketComment.create({
        data: {
          ticketId: paymentGatewayTicket.id,
          authorUserId: userByName.get('P. Sharma')!,
          body: `This is blocked on the SSO rollout — see ${ssoTicket.displayId} for status before we can finish the sandbox test.`,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Demo login: any seeded email + password "password123".');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
