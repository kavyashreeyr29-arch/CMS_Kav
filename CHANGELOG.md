# Changelog

All notable changes to this project are logged here, newest first. Every new feature or non-trivial
change gets an entry — see `CLAUDE.md` for the rule this file exists to satisfy.

## 2026-11-23 — Added: Free-tier Vercel, Render, and Neon deployment

### Added
- Render Blueprint configuration for a free `elevatohub-api` web service, with Neon-backed `prisma db push` initialization during builds.
- Vercel frontend configuration for `VITE_API_BASE_URL=https://elevatohub-api.onrender.com/api/v1` and production CORS support for the Vercel origin.
- Production deployment documentation covering Neon PostgreSQL, Render, Vercel, object storage, and free-tier sleep behavior.

### Changed
- Seed storage initialization now supports environment-provided Neon/R2-compatible or AWS S3 endpoints instead of assuming the local MinIO Docker hostname.
- Production CORS now accepts the configured frontend origin and all Vercel `*.vercel.app` origins, restoring browser login from the public Vercel deployment.

## 2026-08-18 — Fixed: Team Hours "view history" crashed on a manual entry with no ticket

Reported as two symptoms — "no summary tiles... like before" and "clicking an individual user, the page is
blank, crashing" — that turned out to be the same root cause. This app has no error boundary anywhere
(confirmed via React's own console warning), so one uncaught render error blanks the *entire* app to a
white screen, not just the component that threw — which is consistent with both symptoms coming from a
single crash rather than two separate bugs.

### Fixed
- `WorkHours.tsx`'s "view history" drawer (`/work-hours`, click a person → per-ticket breakdown) assumed
  every `TimeEntry` has a linked ticket and read `e.ticket.displayId` directly. A manual entry logged with
  no ticket (e.g. "daily standup", "on-call handover" — real seed data) has `ticket: null`, throwing
  `Cannot read properties of null (reading 'displayId')` the moment that row rendered.
- `WorkHoursEntry.ticket` was typed as always-present (`{ id, displayId, title }`) when the backend
  (`TimeEntriesService.drillDown()`) always could return `null` for it — the type was lying about the shape
  of real data, which is exactly why TypeScript never caught this. Now typed `... | null`, and both the
  table row and CSV export show "No ticket — manual entry" instead of crashing, matching the pattern
  `Timesheet.tsx`'s own manual-entries table already used.
- Reproduced directly (not assumed) via a Playwright session with real console/page-error capture, which
  caught the exact stack trace before diagnosing the fix.

### Added
- `phase2d-audit.spec.ts`: a new test that widens the date range to guarantee a manual/ticketless entry
  shows up, opens the drawer, and asserts it renders instead of crashing — the existing drawer test only
  ever exercised whichever entry happened to be first for today's date, which is why this went unnoticed.

## 2026-08-18 — Team-hours grants now audit-log by name, not raw id

`teams.service.ts` was already writing `hoursViewerUserIds`/`hoursViewerRoleIds` changes to the audit log
(bundled into the existing `team.updated`/`team.created` entries) — but as raw UUIDs and role ids, e.g.
`hoursViewerUserIds: f3d835b8-8fe0-... →`. Technically logged, not actually answerable — an admin
reviewing "who granted access to whom" would have had to go look the id up.

### Fixed
- New `TeamsService.describeGrants()` resolves both the before and after id lists to real names
  (`prisma.user`) or role labels (`prisma.role`) before writing the diff, and uses readable field names
  ("Extra hours viewers" / "Extra hours viewer roles") instead of the raw camelCase property names —
  matches the existing "Collaborating teams" ticket-field-change precedent (`tickets.service.ts`).
- `create()` now logs the grant too when it's set right at team creation, not just on a later edit — it
  previously only recorded `memberCount`.

### Verified live
`PATCH` a team with `hoursViewerUserIds`/`hoursViewerRoleIds` set → audit log entry reads
`"Extra hours viewers": { before: "", after: "F. Haddad" }` and
`"Extra hours viewer roles": { before: "", after: "Customer Success" }`; revoking both afterward shows the
same fields flipped (name/label → empty), not just a blank diff.

## 2026-08-17 — Admin-configurable per-team "Team hours" access

Team hours was previously visible only to Admin/Director/PM (org-wide) and a team's own Lead — fixed by
role, nothing an admin could configure. Now an admin can additionally grant a specific person and/or a
whole role access to one team's hours, on top of that existing default (nobody who could already see it
loses access).

### Added
- `Team.hoursViewerUserIds` / `Team.hoursViewerRoleIds` (`String[]`) — admin-set, per team, in the same
  `TeamModal` used to manage the team's Lead and Members (`TeamsAdmin.tsx`, new "Who else can view this
  team's hours" section — role chips and person chips, independent of each other).
- `backend/src/common/permissions/team-access.ts`'s `getGrantedTeamIds()` — the teams a user has explicit
  hours access to: being the team's Lead, individually granted, or granted by role. Plain function (not a
  service) so both `AuthService` and `TimeEntriesService` can call it without a cross-module dependency,
  same reasoning as `ticketVisibilityWhere` living as a standalone function.
- `TimeEntriesService.effectiveWorkHoursVisibility()` — a role's `workHoursVisibility` (none/own/team/org)
  upgraded to `'team'` if the user has any grant, independent of what their role would otherwise allow (an
  Operations person, normally `'none'`, can be granted access to one team without their role changing
  anywhere else). All three Team Hours/Team Timesheet endpoints (`workHours`, `daily`, `team-summary`) and
  the drill-down now go through this instead of the raw role default.
- `AuthService.buildProfile()` folds the same grant check into the `permissions.workHoursVisibility` the
  frontend receives from `/auth/me` — the existing `RolePermissions`-typed UI gates (Team hours nav item,
  the date-range picker, the My Timesheet Team tab) all pick this up with no frontend changes beyond the
  new `TeamModal` section, since `permissions` was already a per-user (seniority-adjusted) object, not a
  purely static per-role one. `effectivePermissions()` itself stays synchronous and unchanged — it's called
  from `PermissionsGuard` on every request and can't become async — the grant is folded in only where the
  profile is built, by cloning the (possibly role-shared, cached) permissions object first.

### Fixed — a real gap found while touching this code
`GET /reports/work-hours/:userId/tickets` (the "view history" drill-down) only checked `userId !== self` for
`'own'`-visibility roles; an `'org'`/`'team'`-visibility viewer could drill into literally any user id, not
just people in their actual scope. Now reuses `canViewUser()` (already used by My Timesheet's own
drill-down) instead of a separate, looser check.

### Verified live
Granted an Operations account (`workHoursVisibility: 'none'` by default) individual access to one team —
`403` before, `200` scoped to just that team's members after, `403` again once revoked. Granted the `qa`
role access to a different team and confirmed a QA user gained access without being individually listed,
while an unrelated grant on another team stayed correctly un-leaked between the two.

## 2026-08-14 — Collapse the Watchers picker; fix a real user-list leak it exposed

A screenshot of the New sub-task modal showed the Watchers picker as a wall of ~80 chips — most of them
"E2e Intake ..." / "E2e Intake Repeat ..." names, not real people.

### Fixed — two real bugs found while looking into it
- `email-intake.spec.ts` calls `POST /email-intake/inbound` with a unique `Date.now()`-based sender email on
  every run, auto-provisioning a brand-new Client user each time (`nameFromEmail()` turns
  `e2e-intake-1786...@example.com` into "E2e Intake 1786..."). It never cleaned up, so **every full
  regression run this session left a new permanent user behind** — 60 had accumulated. Now deletes the
  ticket + disables the auto-provisioned user at the end of each test.
- More importantly, **disabled users were never filtered out of any assignee/watcher/team-member/
  project-member picker** — `GET /users` intentionally still returns them (the Users admin page needs to,
  to re-enable one), but every picker that reused that same response was showing disabled people as
  selectable, not just the email-intake debris. Fixed at the fetch site in `CreateTicketModal.tsx`,
  `TicketDetail.tsx`, `ProjectDetail.tsx`, and `TeamsAdmin.tsx` — filter `status !== 'disabled'` once, right
  where each page calls `usersApi.list()`, rather than four different render-time checks.
- One-time cleanup: hard-deleted the 60 already-accumulated debris users and their orphaned tickets/
  activity-log/audit-log rows (they predate the fix above, so soft-deleting wouldn't have removed the
  clutter — the picker had no disabled-filter yet at the time they were created).

### Changed
- New ticket / New sub-task's Watchers section no longer renders the full candidate list open by default —
  it shows only the currently-selected watchers (if any) plus an "Add watchers" button that expands the
  full picker on click. Same underlying multi-select, just collapsed until asked for.

## 2026-08-14 — Cross-team ticket visibility ("Collaborating teams")

A ticket a call-center agent raises on, say, a redemption issue can need both Tech and Ops to resolve it,
even though it only lives in one team's project. Previously there was no way for a team that didn't own
the ticket to actually see it: a Lead/Manager (the only role tier hard-scoped to their own team — everyone
else already has org-wide `scope: 'all'` by default, see `effective-permissions.ts`) got a flat `404` on
any ticket outside their own team's projects, and the existing Watchers feature only sends notifications,
it doesn't bypass the visibility gate.

### Added
- `Ticket.collaboratingTeamIds` (`String[]`, default `[]`) — an unordered list of other teams tagged as
  needed for resolution. Not limited to two teams or a fixed pairing (Tech+Ops, Tech+Ops+CallCenter,
  Tech+CS, ...) — any combination.
- `ticketVisibilityWhere`'s `'team'` scope now grants access if *either* the ticket's own project belongs
  to the Lead/Manager's team *or* their team is in `collaboratingTeamIds` — the one function CLAUDE.md
  flags as "the thing to protect," extended rather than bypassed.
- `PATCH /tickets/:id/collaborating-teams` — sets the full list (admin/PM/Director/Lead/Manager, same
  `canManageStructure` gate the sub-task/re-parent actions already use); logged to the ticket's field
  history so "who added Ops to this ticket, and when" is answerable the same way any other change is.
- Ticket detail: new "Collaborating teams" panel (mirrors the existing Watchers panel — chips + add/remove)
  showing which other teams have visibility and letting an eligible role tag or untag one.
- A "N teams" badge (`CrossTeamBadge`, `components/ui/Chips.tsx`) on every surface a ticket is browsed from
  — Tickets list, Kanban cards, and the Ticket detail header — so a tagged ticket is visible at a glance
  without opening it. Ticket detail's badge shows the actual team names on hover; the list/board versions
  show just the count (they don't otherwise load team data, and the count alone answers "is this cross-team
  or not").
- Seed data: the feature had nothing to look at on a fresh login — no seeded ticket had `collaboratingTeamIds`
  set, and there was only ever one seeded team (Delivery Squad), so there was no second team to tag anything
  with in the first place. Added a second team ("Platform Ops", led by a new `R. Fonseca` — a second
  Lead-seniority account was required, V. Kapoor alone can't demonstrate a *cross*-team scenario) and a
  realistic demo ticket (`ATLAS-...`, "Redemption points not credited after coupon applied", raised via
  Call Center, tagged for Platform Ops) so logging in as Call Center shows the badge and R. Fonseca can
  actually open a ticket outside Platform Ops' own projects.
  Note: Ops/Call Center/Customer Success accounts are `scope: 'source'` (see all tickets from their own
  channel org-wide already), not `scope: 'team'` — this feature's *visibility* effect only changes anything
  for Lead/Manager-seniority accounts; the badge itself is visible to anyone who can already see the ticket.

### Design notes
- Deliberately manual/triage-time tagging, not auto-inferred from ticket type or category — which teams a
  given issue needs isn't predictable enough to guess reliably.
- Considered splitting into a parent ticket + one sub-task per team (the existing sub-task/linking feature
  needs zero backend changes for that) instead, but rejected it: it fragments "what's the current status,
  pending on whom" across multiple tickets instead of leaving one shared source of truth, which is exactly
  what was being asked for.

## 2026-08-11 — Admin-only delete for Teams, Tickets, and Projects

Labels already had a delete option (soft-delete, gated on `manageLabels`); Teams, Tickets, and Projects
didn't have one at all. Delete is a flat role-permission gate (`userManagement` — the same key Team
create/update already used), not "only rows an admin created": neither `Team` nor `Project` track a
creator field in the schema, and every existing admin-style gate in this app (`userManagement`,
`manageLabels`, `manageRoles`) is a role capability check, never an ownership check.

### Added — `DELETE` endpoints
- `DELETE /teams/:id` — hard delete. Memberships cascade; any project the team led just goes unassigned
  (`Project.teamId` → null), it isn't touched.
- `DELETE /tickets/:id` — hard delete. Comments/attachments/custom fields/change history/test cases/PRs/
  approval requests/time entries all cascade per `schema.prisma`; `ActivityLogEntry`/`Notification` rows
  referencing the ticket just lose the link rather than being deleted. Recorded in the org-level audit
  trail (`ticket.deleted`) since the ticket's own history disappears with it — `TicketsController` didn't
  use `PermissionsGuard` anywhere else, so this route adds it at the method level rather than the class.
- `DELETE /projects/:code` — blocked with a friendly `409` (not a raw FK-violation `500`) while the
  project still has tickets: `Ticket.projectId` is a required FK with no cascade, so Postgres would already
  reject it — this just surfaces that as a readable message before hitting the DB. Everything else
  attached to a project (documents, members, campaigns, rewards, to-dos, notes) cascades cleanly.
- All three gated `@RequirePermission('userManagement')` and audit-logged (`team.deleted`/`ticket.deleted`/
  `project.deleted`), matching the existing Team create/update pattern.

### Added — confirm dialog (first one in the app)
No destructive action anywhere previously had a confirm step (label/business-category remove both fire
immediately). A hard delete with real cascading data loss warranted one — new shared
`components/ui/ConfirmDialog.tsx`, used by all three new delete flows: Teams admin (button in the edit
modal's footer), Ticket detail (trash icon in the header actions), Project detail (trash icon in the
header actions). All three buttons are admin-only (`permissions.userManagement`), matching the backend gate.

### Fixed — recurring Teams-admin test debris
`teams-admin.spec.ts` created a team on every run and never deleted it, leaving ~25 "E2E Team ... Renamed"
rows cluttering the Teams page over the life of this session. Now deletes what it creates as its last
step, exercising the new delete feature at the same time.

## 2026-08-10 — Full sanity pass: seed-data gaps, 2 real bugs, CSV export everywhere, cycle-time analytics

User request: check for other errors, test end-to-end, explain what the Workflow module does, fill in seed data
so every section shows real state, and make sure everywhere data is displayed is also downloadable.

### Checked — no other errors
Backend/frontend typecheck clean, backend logs (48h window) had zero runtime errors, full Playwright suite
passed (the only failures seen mid-session were the already-documented Team Hours day-rollover timing flake,
confirmed passing in isolation as before).

### Fixed — two real bugs found while auditing
- **`ActivityLogEntry.projectCode` was declared but never populated by any of its ~15 call sites** across
  tickets/github/approvals — silently broke Dashboard's per-project "Recent activity" filter
  (`activity.filter(a => a.projectCode === projectFilter)` always matched nothing whenever a specific project
  was selected). Fixed at the single choke point instead of touching every caller:
  `activity-log.service.ts`'s `record()` now derives `projectCode` from `ticketId` itself when the caller
  didn't supply one. Verified live — a freshly created ticket's activity entry now carries the right code.
- **New Audit log CSV export requested `limit: total` in one call**, but the API caps `limit` at 100
  (`@Max(100)` on the DTO) — the button silently did nothing past ~100 logged actions (an unhandled 400,
  found via a Playwright test that actually waited for the download event rather than just asserting the
  button existed). Fixed by paginating the export in 100-row pages instead of one oversized request.
- Also deleted ~1785 orphaned `activity_log` rows accumulated this session from repeatedly cleaning up E2E
  test tickets via direct SQL without also clearing their activity trail — self-inflicted debris, not a
  product defect, but it was cluttering "Recent activity" with references to tickets that no longer exist.

### Added — seed data for every previously-empty section
- Kanban's status cycle only ever produced `Open`/`InProgress`/`Completed` for the main per-project ticket
  batch — `Assigned`, `InReview`, `Closed`, `Reopened` (3 of 11 board columns) had zero tickets on a fresh
  seed. `TICKET_STATUS_CYCLE` now covers all eight engineering-delivery statuses.
- GitHub integration and AI integrations pages showed a bare "not connected"/empty state — now seed a
  connected demo repo (with `onPrOpened/Approved/Merged` auto-transition targets set, so the Development panel
  and Workflow gates have something real to demonstrate) and a default OpenAI provider config.
- Docs & Files / commercial documents and one SLA policy document are now real MinIO objects (not just DB
  rows pointing at nothing) — uploaded via the Docker-internal `minio:9000` endpoint from `seed.ts` (distinct
  from the browser-facing `S3_ENDPOINT`, since the seed script runs inside the backend container). Verified
  by actually downloading one through the real presigned-URL flow.
- Manual timesheet entries previously existed for only one person; two more now have a mix of automated +
  manual entries so the Team overview shows real variety.
- "Recent activity" was always empty on a fresh seed (`seed.ts` creates tickets directly via Prisma, bypassing
  the service layer that writes activity log entries) — seeded a handful of realistic entries across projects.
- A synthesized status-transition trail (`TicketFieldChange`, `fieldName: 'Status'`) on 10 Completed tickets,
  for the new cycle-time panel below — same reasoning as Recent Activity, seed.ts never generates this
  organically.

### Added — "Time in status" analytics panel (`GET /analytics/cycle-time`)
Average time a ticket spends in each status before moving on (or "now", if it's still there) — the
bottleneck-finder for the configurable Workflow: a high average means tickets are actually getting stuck
there, gate or no gate. Computed from `TicketFieldChange`'s existing `'Status'` entries (already written on
every transition) rather than a new tracking mechanism — grouped by ticket, consecutive-change durations
summed per status, sorted longest-stuck-first. Horizontal bar chart on `/analytics`, with CSV export.

### Added — CSV export across ~20 previously-missing pages/panels
Dashboard (tickets-raised-by, ticket ageing, team workload, project health, upcoming due dates, recent
activity, and the shared `LabelBreakdown` component so Dashboard/MyBoard/Analytics's recurring-issue panel all
got it at once), My tickets summary, Backlog, Users, Teams, Audit log, Labels, Business categories,
AI integrations, Workflow's transition/gate matrix, and — on the ticket/project detail pages — Activity,
Change history, Attachments, QA test cases, Development (PRs), Approvals, and every project folder tab
(Campaigns, Rewards, Communication, To-do, Docs & Files manifest). All using the existing shared
`exportToCsv()` helper, no new export mechanism introduced.

## 2026-08-05 — Ticket linking: copy link, auto-linked references, sub-tasks, convert to standalone

User request: a way to copy a ticket's link and reference it from another ticket, plus create sub-tasks and
later convert them back to standalone tickets.

### Added — ticket lookup by displayId
`backend/src/tickets/tickets.service.ts`'s `findOne()` now matches on `id` OR `displayId` (was `id` only) — a
`GET /tickets/:id` accepts either the internal UUID every in-app navigation already uses, or a human-readable
reference like `ATLAS-1024`. This is what lets a "copy link" URL and a bare displayId typed into a comment
both resolve through the exact same route, with no separate lookup endpoint needed.

### Added — `PATCH /tickets/:id/parent`
`Ticket.parentTicketId` was already settable at creation time (`CreateTicketDto`) but had no way to change
after the fact. New `linkParent()` in `tickets.service.ts` (mirrors the existing `linkCampaign`/`linkReward`
pattern) sets or clears it, validates a ticket can't be its own parent, and walks the prospective parent's
ancestor chain to reject anything that would create a circular sub-task chain. Verified live via curl,
including the self-parent and cycle rejections, before touching the UI.

### Added — Copy link, Add sub-task, Convert to standalone (`frontend/src/pages/TicketDetail.tsx`)
- **Copy link** — copies `{origin}/tickets/{displayId}` (not the current UUID-based URL) to the clipboard,
  Copy/Check icon-swap matching the existing pattern in `GithubIntegration.tsx`. Verified the clipboard
  actually contains the displayId-based URL, not just that the button changed state.
- **Add sub-task** — `CreateTicketModal.tsx` gained a `subtaskOf` prop: when set, the parent is fixed (no Epic
  picker), the project is locked to the parent's, and it applies to any ticket type — sub-tasks aren't
  restricted to the existing Story-under-Epic pairing. Creating one navigates straight to the new ticket,
  which shows "Part of: `<parent>`" immediately.
- **Convert to standalone ticket** — shown next to "Part of" on any ticket that has a parent; calls the new
  parent endpoint with `null`. Both actions gated on the same internal-delivery-role check QA management
  already uses (`scope === 'all' || 'team'`), not tied to the ticket's status the way title/description
  editing is — re-parenting makes sense at any point in a ticket's lifecycle.

### Added — auto-linked ticket references (`frontend/src/components/ui/Linkify.tsx`)
Comment bodies and ticket descriptions now auto-link two things: a bare displayId mention (e.g. "see
ATLAS-1024") and any pasted URL — the Jira/GitHub smart-commit convention. New `GithubPullRequest` model caches PR
  state (open/closed/merged), review state (pending/approved/changes_requested), branch, and author.
- **Auto-transition**: on PR open/approve/merge the linked ticket moves per the status map — always through
  the workflow gates. Automated moves are attributed to a per-org "GitHub Automation" system user (find-or-
  create, mirroring email-intake's auto-provision; excluded from the Users & Roles list) so activity-log
  actor FKs stay honest.
- **Jira-style Development panel** on the ticket detail (`DevelopmentPanel.tsx`): linked PRs with state badge,
  review/approval state, branch, author, and a link out to GitHub; unlink control. Ticket detail response now
  includes `pullRequests`.

### Added — multi-dimension board
- The Kanban gained a **Group by** switcher — **Status** (classic draggable, workflow-gated columns),
  **Assignee**, **Priority**, **Type**, and **Epic** (swimlanes with per-lane counts, tickets ordered by
  status within each lane). Cards show a "N PRs linked" badge. The ticket-list include now carries `parent`
  and a `pullRequests` count to power epic lanes and the badge without pulling every PR row.

### Fixed — permission hydration backfills newly-added fields
Adding `manageWorkflow` to `RolePermissions` surfaced a latent bug: `RolesService.onModuleInit()` loaded a
role's stored `permissionsJson` into the cache **as-is**, so a role edited before a new permission field
existed came back missing that key — and since the update DTO now requires every field, saving that role's
permissions 400'd ("manageWorkflow must be a boolean value"). Fixed by merging stored permissions over a
complete default (`withPermissionDefaults()` / new `BASELINE_PERMISSIONS`): built-in roles merge over their
hardcoded default, custom roles over a locked-down baseline, so a capability added later defaults to OFF for
a pre-existing role and the returned object always has every key. Forward-compatible for the next permission
field too.

### Added / changed — tests
- New: `e2e/tests/workflow-gates.spec.ts` (gate config UI + nav gating + full block→link-merged-PR→allow
  enforcement), `github-webhook.spec.ts` (HMAC rejection, signed PR-open auto-link + auto-transition verified
  through the Development panel, review-approval state), `board-grouping.spec.ts` (all five groupings).
- Updated three pre-existing tests for the now-deterministic transition rules: `tickets.spec.ts` (status-
  persist test now creates a fresh Open ticket and does the valid Open→InProgress move instead of an
  arbitrary jump on an unknown-status row), `role-sweep.spec.ts` (Admin nav list gained Workflow + GitHub
  integration). `ticket-dates.spec.ts`'s Open→Closed path remains valid under the default workflow.

## 2026-07-28 — Basecamp-style project folders, ticket date fields, campaign tracking

### Fixed — ticket time-logged history now shows which date work happened
User feedback: "along with time mention on which date he has worked on it." The Team Hours "View history"
drawer (`WorkHours.tsx`'s `HistoryDrawer`) listed every timer session for a person with just Ticket/Title/
Hours — no date, even though the backend's `drillDown()` query already returned each entry's `startedAt`.
Added a **Date** column (now the leading column) to both the table and the CSV export. Each row is a
distinct timer session, not an aggregate — so the date is meaningful per row, not just a range label.

### Added — ticket detail: Created, Last modified, Started, Closed
User feedback: "ticket created date, last modified date, due date... start date will be the day when the
timer has started and end date would be when the ticket is moved to closed."
- `Ticket.closedAt` (new column) — set when a status change lands on `Closed`, cleared on reopen
  (`tickets.service.ts` `updateStatus()`/`reopen()`). Distinct from `updatedAt`, which changes on any edit.
- "Started" is **not** the existing manually-set `startDate` field — it's computed from the earliest
  `TimeEntry.startedAt` on the ticket (the list endpoint computes `actualStartAt` server-side from an
  already-fetched `timeEntries` selection; the detail endpoint already returns the full `timeEntries` array,
  so the client computes it there). Shows "Not started" until a timer has actually run once.
- Ticket detail's meta grid gained visible Created/Last modified/Started/Closed cells, replacing a tiny
  gray footnote that only had Created/Modified.
- Ticket list's "Start" column renamed **"Started"** and now shows `actualStartAt` (or "—") instead of
  falling back to `startDate ?? createdAt` — it was showing a manually-set plan date or the creation date,
  neither of which is "when did work start." CSV export gained Created/Started/Closed columns too.

### Added — Basecamp-style project folders
User feedback: "enhance the project section more like basecamp tool where there are folder within a project
for Docs and file, campaign, communication, reward, tickets, todo list." `ProjectDetail.tsx` (159 lines, one
flat panel) split into a tabbed page — Overview / Docs & Files / Campaigns / Communication / Rewards /
To-do list, plus a Tickets tab that jumps straight to the real Tickets page pre-filtered to the project
(reusing its full filter/column/CSV machinery) rather than a second, cut-down ticket list living in a tab.
- **Campaigns** and **Rewards** are standalone entities (not just ticket labels) — new `Campaign` model
  (name, status Planned/Active/Completed, description, start/end date) and `Reward` model (name, type,
  value, description), both project-scoped. Tickets can optionally link to one (`Ticket.campaignId`/
  `rewardId`, new `PATCH /tickets/:id/campaign` and `/reward` endpoints) — the tab's detail panel lists
  linked tickets and lets you link an existing one from a dropdown.
- **Communication** is a lightweight per-project message board (new `ProjectNote` model — author, body,
  timestamp) — distinct from ticket comments (per-ticket) and the existing org-wide Comms & Tracking page
  (intake-channel configuration, not a discussion feed). Post/delete-own-or-admin only, deliberately no
  edit, matching Basecamp's own Campfire simplicity.
- **To-do list** is a new lightweight checklist (`ProjectTodoItem` — title, done, assignee, due date) —
  deliberately not a Ticket: no status workflow, no SLA, no assignment notifications. Quick items that don't
  warrant a full ticket.
- **Docs & Files** unchanged in behavior, just moved into its own tab. `ProjectDocument` gained an optional
  `section` tag (`campaign`/`communication`/`reward`/`todo`, null = general) plus optional `campaignId`/
  `rewardId` so uploads file into the right folder — Campaign/Reward files are further scoped to the
  specific record, Communication/To-do files are shared per-project buckets.
- "Total tickets" (and the new Tickets tab) are now **actionable** — "when i click on total tickets it
  should open and display all tickets" — both call the same `setProjectFilter()` + `navigate('/tickets')`
  pattern the existing "View in dashboard" button already used, landing on the Tickets page pre-filtered to
  the project instead of being a static number.
- New backend modules: `campaigns/`, `rewards/`, `project-todos/`, `project-notes/` — each follows the
  existing `findOne(projectCode, user)`-gated-visibility pattern from `ProjectsService`, no new permission
  field added (any user who can see the project can add campaigns/rewards/todos/notes to it, matching
  Basecamp's own collaborative-by-default model and the existing looser gate on adding a project document).
- **Bug found and fixed while building this**: `ProjectDetail.tsx`'s `load()` set `loading: true` on every
  refresh, not just the initial mount — since the top-level `if (loading) return <div className="loading-state">`
  guard unmounts the whole page, every background refresh (linking a ticket, adding a member, uploading a
  file) blanked the entire page and reset every tab component's local state (which campaign/reward was
  expanded, which tab was active). Fixed by only blanking on the very first load (`loading && !project`).

### Added — Campaign & promotion tickets summary (Analytics)
User feedback: "there should be a label or category like campaign or promotion where if any ticket is raised
against these topics then there should be summary given against it how many ticket against campaign were
raised month quarter year, this campaign summary should be visible to admin, director lead, manager and
customer success." Since Campaign is now a standalone entity (see above, not a label), the summary is "how
many tickets are linked to a Campaign" — new "Campaign & promotion tickets" panel on the Analytics page,
respecting the same month/quarter/year/custom period selector every other panel on that page already uses.
`GET /campaigns/summary` returns the raw campaign-linked ticket rows (org-wide); the frontend buckets/groups
them client-side, consistent with how every other Analytics panel already works off an already-fetched
ticket set.
- Gated to `admin`/`director`/`lead`/`pm`/`customersuccess` — "Manager" in the request maps to the existing
  `pm` (Project Manager) role, matching this codebase's own established use of "Manager" in
  `ProjectsService.isLeadershipTier()`'s comments.
- **Widened `customersuccess.adminAnalytics` from `false` to `true`.** Customer Success previously had no
  path to the Analytics page at all (no nav item, since the nav item's visibility is gated on that same
  flag) — the summary would have been permitted server-side but unreachable through the UI. Rather than
  build a second, narrower access gate just for this one panel, widened the existing flag the same way
  Director/PM/Lead were widened in an earlier session (see "Dynamic RBAC" entry below) — Customer Success
  now gets the same full Analytics page those roles have.

### Added — tests
`e2e/tests/project-basecamp-folders.spec.ts`, `ticket-dates.spec.ts`, `campaign-summary-analytics.spec.ts`.
Fixed three pre-existing tests whose assertions described the now-intentionally-changed behavior:
`phase2d-audit.spec.ts` (time-logged modal's first column is now Date, not Ticket), `attachments.spec.ts`
(project document upload now requires clicking the Docs & Files tab first), `phase11-audit.spec.ts` (ticket
list column renamed Start → Started).

## 2026-07-28 — Audit logging, Dashboard/Analytics rework, Teams & Business Categories admin, Elevatoz rebrand, voice/video ticket attachments

A single large user-feedback pass covering the whole app — walked through it as 20 tracked items, each with
its own Playwright coverage. Grouped here by area rather than as 20 separate dated sections.

### Added — Admin activity/audit log
User feedback: "admin should have logs to all activity of whoever do any action anywhere and even the admin
changes log should be saved... member disable, permission change, modification etc should have logs of when
it was done, what time, who did it, and what changes were made."
- New `AuditLogEntry` model (`backend/prisma/schema.prisma`): `orgId`, `actorUserId`, `action`, `targetType`,
  `targetId`, `targetLabel`, `changes` (`Json?`, before/after diff), `createdAt`.
- `backend/src/audit-log/audit-log.service.ts` — `record()` + `list(orgId, {limit, offset, action?,
  targetType?})`; `diffFields<T>()` helper computes a before/after diff of only the keys that actually
  changed.
- Wired into every user-management mutation that previously had no trail: `users.service.ts`
  (create/update/remove — member add, disable, role/permission change), `roles.service.ts`
  (role.created/role.permissions_updated), `teams.service.ts` (create/update). Each records the actor —
  including when the actor is an admin acting on their own account or another admin's.
- `GET /audit-log`, gated by the existing `userManagement` permission — no new permission field needed.
- New `/audit-log` page (`frontend/src/pages/AuditLog.tsx`): paginated table (20/page, "Load more"), action
  labels/tone colors per action type.
- **Used the feature to find a real bug while building it**: the audit log surfaced that the Intern role's
  `comms` permission was `false` in the DB against a hardcoded default of `true`, with no audit trail
  explaining why (predates this feature). Fixed the live data via API PATCH, and fixed the root cause class —
  `backend/prisma/seed.ts` now resets every built-in role's `permissionsJson` to `Prisma.JsonNull` on every
  seed run, so a stale manual override can't silently persist across reseeds.
- Tests: `e2e/tests/audit-log.spec.ts`.

### Changed — Dashboard: "tickets raised by" role grouping
From the user's screenshot description: wanted ticket counts by who raised them — Client, Helpdesk, Project
Manager, Customer Success, Operations, and a combined "Tech" bucket (developers/QA/engineer/senior+junior
dev/lead/manager/tech support). Replaced the old "Raised by source" panel with a 6-stat "Tickets raised by"
panel driven by a `ROLE_CATEGORY` map grouping every role id into one of those six buckets.

### Fixed — Ticket ageing by project
- "View all" on the ageing panel was rendering the *label* summary instead of the ageing table — now shows
  the full per-project ageing breakdown, toggled locally instead of navigating away.
- Added an **SLA column**: the best-matching SLA policy per project (via the existing project→priority
  resolution used on ticket creation) with a breach count, a "✓ within SLA" state, or "No SLA" when nothing
  applies — answers "how would I know this project has an SLA and whether it's breached?"
- Fixed the "5 vs 10" alignment complaint: the ageing panel's item limit (5) and the Team workload panel's
  limit were inconsistent; both now use the same `WORKLOAD_LIMIT` constant.

### Fixed — Team workload
Clarified the panel's subtitle (estimated open/unfinished hours per assignee, bar fills toward 40h/week
capacity) and fixed "View all" — it was `navigate()`-ing to `/analytics`, which has nothing to do with
per-assignee workload. Now expands the full list in place, matching every other "View all" on the page.

### Changed — "View all" pattern, applied consistently
Generalized the fix above: every "View all" button that previously redirected to Analytics (workload, project
health, upcoming due dates, etc.) now toggles a local `showAllX` state between a capped slice and the full
list, instead of navigating to an unrelated page.

### Changed — Analytics overhaul
User feedback: wanted month/quarter/year and from-to date filters everywhere, and "insights... think from a
company CEO perspective... on the tasks and developments and closures."
- Added a period filter (`month` / `quarter` / `year` / custom from-to range) that drives every section on the
  page — headline stats, trend, funnel — off the same selected range.
- New headline stats (total/closed/SLA compliance for the selected period), a Performance trend chart, and a
  Delivery funnel across Planning → Development → Testing → Deployed stages.
- Kept the existing label breakdown, client-raised-by-project table, resolution-time-by-priority, developer
  productivity, hours-by-business-category, and project-wise performance (CSV export) sections.
- `frontend/src/api/analytics.ts`'s `productivity()` now accepts an optional `sinceDays` so it can respect the
  period filter too.

### Added — Backlog explanatory banner
User asked "what are you trying to show in backlog page?" — added a banner explaining Epics/Stories, drag
ordering, and the four roadmap stages, rather than assuming it was self-evident.

### Changed — Comms & tracking pagination
Too many line items to scan at once. Now shows the most recent 10 with a "View all N →" toggle and a
"Download CSV" export of the full list.

### Changed — Team Hours: per-day view
"Team hours should display the per-day number of productive hours provided, highlighted if less than 6
hours." Added `GET /reports/work-hours/daily` (`backend/src/time-entries/`) and a By-day view on the Team
Hours page with a day-by-day grid; any cell under 6 productive hours is highlighted red, and a "low" chip
marks it on the single-day summary view too.

### Changed — Users & Roles redesign
"Old school", too big a page to scan. Rebuilt grouped by role's department (`baseRole.group`), sections
collapsed by default, with a search box that auto-expands whichever group contains a match — replacing one
long flat list with a compact department-first view.

### Added — Teams admin
"Admin should be able to create teams and, based on teams, the required permissions." New `/teams` page —
create/edit teams as a card grid; team mutations are audit-logged like everything else in this pass. Reused
the existing `userManagement` permission to gate visibility rather than adding a dedicated field.

### Verified — Analytics permission
User asked whether "analytics" was listed as an explicit permission under Roles admin. It already was
(`RolePermissions.analytics`) — confirmed present in the Role & Permission Matrix UI, no code change needed.

### Added — Business Categories admin
"Admin should be able to manage categories, business categories, not just labels." `BusinessCategory` was
previously a fixed Prisma enum; converted to a full admin-manageable table (mirroring the existing `Label`
model) — `orgId`, `name`, `active`, `createdBy`. New `/business-categories` admin page, same pattern as
Labels. `Ticket.businessCategory` changed from an enum column to a plain string, so any org-defined category
name works. Ran `prisma db push --accept-data-loss` (dev data, recovered via reseed) and updated
`backend/prisma/seed.ts` to seed categories as rows instead of enum values.

### Changed — SLA policies: per-project scoping
"SLA should be able to attach [to a] project [since it] differs project to project." The SLA policy model
already supported an optional `projectId` on the backend; the admin UI didn't expose it. Added a Project
picker to the SLA Policies create form and a Project column to the table.

### Changed — Rebrand to Elevatoz colors
"Required more appealing UI... use Elevatoz colors: Primary #004053, Secondary #FFFFFF."
- `frontend/src/styles/tokens.css`: `--brand` `#362F9E` → `#004053`; `--brand-soft` `#EDECFB` → `#E3EEF0`;
  renamed `--lime` → `--accent` (`#B4FF39` → `#2DD4BF`), since it's teal now, not lime.
- Deliberately left semantic/status colors alone (critical/high/medium/low, SLA breach colors, the ageing
  0-2d/3-5d/etc. scale, and the per-label color palette in `colorForLabel.ts`) — those encode meaning, not
  brand identity, and recoloring them would make existing severity cues unreadable.
- Found and fixed two leftover hardcoded old-brand hex values the token rename didn't reach (Recharts `fill`
  attributes and a couple of hover states don't resolve CSS custom properties): `Dashboard.tsx`/
  `Analytics.tsx` chart fills, and `global.css`'s `.btn-primary:hover`/`.att-download` which were still using
  the old purple's hover-darken shade and glow color.
- Verified visually via a full-page dashboard screenshot across sidebar, KPI cards, charts, and buttons.

### Added — real Elevatoz logo + redesigned login page
The sidebar/login "E" mark had been a CSS placeholder since the earliest scaffold — no logo asset existed
anywhere in the repo. The user supplied the actual Elevatoz logo (teal `#004053` square, gold infinity-loop
mark, white "elevatoz" wordmark) as an image; saved to `frontend/public/elevatoz-logo.png` and wired into
both places the placeholder lived:
- `Sidebar.tsx`: `.logo` is now the real image instead of a text "E" in a gradient box.
- `Login.tsx`: rebuilt as a two-pane layout — a dark-teal brand panel (logo, "ElevatoHub" wordmark, tagline,
  three short value-prop bullets) beside the actual sign-in form, instead of the form and the test-only
  quick-login panel sitting side by side with no visual hierarchy. The quick-login panel (still
  test-only — see `demoAccounts.ts`) now sits below the form card, restyled but functionally identical (same
  `.panel`/button structure the existing `quick-login.spec.ts`/`auth.spec.ts` selectors depend on).
- Sampled the logo's gold ring color directly from the PNG (`#FBC210`) and added it as `--gold` in
  `tokens.css` — kept distinct from `--accent` (teal, used for nav highlight state) since it's specifically
  the logo's own identity color, used only in the two ambient corner glows on the login brand panel.
- First pass had the two corner glows overlapping enough to blend gold+teal into a muddy olive wash across
  the top of the panel — fixed by shrinking/dimming both (blur 60px→80px, opacity ~0.2→~0.13) and giving the
  brand panel and form side each an explicit `height: 100vh` (previously an implicit flex-stretch match to
  the taller sibling, which is what let the glows drift out of their intended corners in the first place).
- Verified via a full-page screenshot and a re-run of `auth.spec.ts`/`quick-login.spec.ts`/
  `client-ticket-experience.spec.ts` (12 tests, all passing) — none of those selectors reference the visual
  styling, only labels/roles, so the redesign didn't need any test changes.

### Added — UI animation/transition pass
"Impressive animation UI." A tasteful pass, consistent with the existing hover polish already on
`.kpi`/`.proj-card`/`.kcard`:
- Route-level fade-in (`global.css` `.page-fade`, wired in `AppShell.tsx` keyed by `location.pathname`) so
  page content transitions in on every navigation, not just first load.
- Modal and notification-dropdown entrance animations (fade + scale/slide) instead of appearing instantly.
- Press feedback (`:active` scale) on primary/ghost/icon buttons and select-pills.

### Added — Voice/video recording on ticket creation
"During ticket creation, voice upload or video upload option." Generic file upload already accepted any file
type, but there was no in-browser recording. Added `MimeKind.audio` to the Prisma enum, and a new
`MediaRecorderCapture` component (`frontend/src/components/ui/`) using `getUserMedia`/`MediaRecorder` — a
"Record voice note" and "Record video" control next to the existing file dropzone in `CreateTicketModal`,
with a live timer while recording, an audio/video preview after stopping, and Attach/Discard actions. Attached
clips flow through the same signed-upload path as any other file attachment.
- `e2e/playwright.config.ts`: added Chromium's `--use-fake-device-for-media-stream`/
  `--use-fake-ui-for-media-stream` launch args and `microphone`/`camera` permissions so
  `getUserMedia()` resolves headlessly in tests instead of hanging on a permission prompt.
- Tests: `e2e/tests/ticket-media-recording.spec.ts` — records and attaches both a voice note and a video note,
  verifies the attachment shows up on the created ticket.

## 2026-07-27 — Admin permission audit + richer seed data (Backlog, SLA policies)

User feedback: "all feature and functionality should be accessible to admin. add dummy datas to
everything even for backlogs."

### Verified — admin already has every capability
Audited `ROLE_PERMISSIONS.admin` (`backend/src/common/permissions/role-permissions.ts`) and every
explicit role check in the codebase (`grep` for `baseRoleId ===`/`role.id ===` across both
`backend/src` and `frontend/src`) — no gaps found. Confirmed live via login: the returned `permissions`
object has every field at its most-permissive value (`scope: 'all'`, and all 15 booleans `true` except
`simpleDashboard`, which is correctly `false` — that flag means "show the restricted single-role summary
instead of the full dashboard," and admin gets the full dashboard). No code changes were needed here; this
was already correct going into this session (including from the dynamic-RBAC and leadership-visibility
work earlier today).

### Fixed — `backend/prisma/seed.ts` was mostly empty in two real ways
- **Every seeded Epic and Story was hardcoded to `status: Open` forever.** With today's Backlog Roadmap
  feature (stage = Planning/Development/Testing/Deployed, derived from status), a fresh seed made every
  Epic/Story sit in "Planning" — the new feature had nothing real to demonstrate. Replaced the flat
  `EPIC_TITLES`/`STORY_TITLES` arrays with `EPICS`/`STORIES` config tables: 3 Epics per project, each at a
  different stage with a coherent narrative (one fully **Completed**, one **InProgress** with a
  mixed-stage story spread — one Completed, one InProgress, one QATesting — showing partial completion in
  its progress bar, one still **Open**/unstarted with three Planning-stage stories).
- **SLA policies were not seeded at all.** The SLA Policies page, the ticket-list SLA badge, the
  breach-sweep cron, and this session's earlier "expected first response" note on ticket creation all
  assume policies exist — a fresh `npm run seed` left the page completely empty until an admin manually
  created one. Added 6 org policies covering every scope the feature supports: one per priority
  (Critical/High/Medium/Low, org-wide), one project-specific override (ORION, tighter targets matching its
  Critical-tier banking client), one client-name-scoped policy (Meridian Bank).
- Added a couple of comments on the in-flight (InProgress/QATesting) Stories and a watcher each, so a
  freshly seeded ticket detail page has real activity instead of an empty shell.

### Verified
- Ran `npm run seed` clean; confirmed via direct DB queries: 6 SLA policies across every scope, Epic/Story
  status spread across all 4 roadmap stages for every project, comments present.
- Full Playwright suite (86 tests) passes against the new seed data.

## 2026-07-27 — Email-to-ticket intake

User feedback: "any email raised to support.elevatoz@loyalty.com should be created as ticket." Built the
app-side webhook this requires; connecting a real mailbox to it is external provider configuration this
code can't perform on its own (no DNS/mailbox account access) — see README.md "Email-to-ticket" for the
AWS SES / SendGrid / Mailgun options and exactly what env vars + endpoint to point at.

### Added — schema
- `TicketSource.EmailInbound` — a new source value distinct from `ClientPortal`/`CallCenter`/etc., since
  email is its own intake channel.

### Added — `backend/src/email-intake/` (new module)
- `POST /email-intake/inbound` — accepts a provider-agnostic `{ from, subject?, body?, projectCode? }`
  payload. Protected by `EmailIntakeSecretGuard`, a shared-secret Bearer-token check
  (`EMAIL_INTAKE_SECRET`) rather than `JwtAuthGuard` — there's no logged-in user on a webhook call, and
  with no secret configured the endpoint refuses everything rather than accepting requests unauthenticated.
- `EmailIntakeService.ingest()`: finds an existing `User` by the sender's email within the org; if none
  exists, auto-provisions a `client`-role account (name derived from the email's local-part, a discarded
  random password since nobody logs in with it — it only exists to satisfy `Ticket.reporterUserId`, a
  required FK). Resolves the target project from `projectCode` in the payload or
  `EMAIL_INTAKE_DEFAULT_PROJECT_CODE`; throws a clear 400 if neither is set. Builds a synthetic
  `AuthenticatedUser`/`RolePermissions` pair for that reporter and calls the existing
  `TicketsService.create()` — reuses all of ticket creation's existing behavior (activity log, @mention
  notifications, display-id sequencing) instead of duplicating it. Ticket type `Support`, priority
  `Medium`, source `EmailInbound`.
- Verified live via curl: 401 with no/wrong secret; a new sender's first email auto-provisions their user
  and creates a ticket; a second email from the same sender reuses the same reporter (`reporter.id`
  matched), no duplicate user rows.

### Fixed
- `frontend/src/components/ui/Chips.tsx`'s `formatSource()` had no entry for the new `EmailInbound` value
  (would have rendered the raw enum string instead of a formatted label) — added `EmailInbound: 'Email'`.

### Added — tests
- `e2e/tests/email-intake.spec.ts` — per CLAUDE.md's "hit the endpoint directly" bar for a backend-only
  change, uses Playwright's `request` fixture (not curl) so it's part of the same suite: rejects
  missing/wrong secret; a new sender's email creates a ticket and is verified through the actual UI (ticket
  detail page shows the subject and an "Email" source chip, not just the raw API response); a repeat
  sender reuses the same reporter.

## 2026-07-27 — Dynamic RBAC: admin-configurable roles & permissions

User feedback: "admin should be able to create roles based on roles what feature and functionality one
should have — all kind of configuration should be available for admins" and "all features we have should
be configurable for any roles based on admin decision." Permissions were previously a hardcoded TS object
(`ROLE_PERMISSIONS` in `role-permissions.ts`) — this makes the full 16-field `RolePermissions` shape
DB-backed and editable from a new admin screen, for both the 12 built-in roles and any new custom role an
admin creates, with changes taking effect immediately (no server restart).

### Added — schema
- `Role.permissionsJson` (`Json?`) — null for a built-in role until an admin edits it (the hardcoded
  default in `role-permissions.ts` still applies); always set for a custom role.

### Changed — `backend/src/common/permissions/role-permissions.ts`
- Added `manageRoles: boolean` to `RolePermissions` — gates the new admin screen itself; `true` only for
  the built-in `admin` role, so a custom role can never grant itself this capability through the UI.
- `permissionsFor()` now reads from an in-memory `Map` cache (seeded from the existing hardcoded
  `ROLE_PERMISSIONS` defaults) instead of indexing the static object directly — kept **synchronous**
  deliberately, since it's called from `PermissionsGuard.canActivate()` on every permission-gated request.
  New `setRolePermissions()`/`roleExists()` exports are the only way to write to the cache.
- `SOURCE_BY_ROLE` widened from `Partial<Record<RoleId, string>>` to `Record<string, string>` plus a new
  `setSourceForRole()` — a custom role created with `scope: 'source'` can now register its own channel
  mapping so `ticketVisibilityWhere()` has something to filter on (unset = sees nothing, not broken).

### Added — `backend/src/roles/roles.service.ts` (new)
- `onModuleInit()` hydrates the cache from every `Role` row's `permissionsJson` at boot.
- `create()` — validates the role id doesn't already exist, persists to `Role` (`permissionsJson` +
  `defaultScope` derived from `permissions.scope`), and writes straight into the cache — no restart needed
  before the new role is usable.
- `updatePermissions()` — same immediate-cache-write pattern for editing an existing role (built-in or
  custom).
- `findAll()`/`permissionMatrix()` — now DB-backed instead of iterating the old hardcoded `ROLE_IDS`
  constant, so custom roles show up in both the Users page's role dropdown and the Role & Permission Matrix
  modal automatically.

### Changed — `backend/src/roles/roles.controller.ts`
- `POST /roles` and `PATCH /roles/:id/permissions`, both gated by the new `manageRoles` permission via the
  existing `@RequirePermission()` decorator/`PermissionsGuard` — no guard code changes needed, it's fully
  generic over `RolePermissions` keys.
- New DTOs (`backend/src/roles/dto/`): `RolePermissionsDto` (full 16-field payload, `class-validator`
  decorators matching every field), `CreateRoleDto` (id/label/group/permissions, id validated as lowercase
  snake_case), `UpdateRolePermissionsDto`.

### Fixed — `backend/src/users/dto/create-user.dto.ts` + `users.service.ts`
- `baseRoleId` validation was `@IsIn(ROLE_IDS)` — a **compile-time-fixed 12-role list**. Once custom roles
  became creatable at runtime, this would have permanently rejected assigning any user to a role created
  after server boot, defeating the entire feature. Replaced with `@IsString()` at the DTO layer plus an
  explicit `roleExists()` check in `UsersService.create()`/`update()` (checks the live cache, so newly
  created custom roles work immediately).

### Added — `frontend/src/pages/RolesAdmin.tsx` (new admin page, `/roles`)
- Role list (left) + permissions editor (right): every `RolePermissions` boolean as a checkbox, scope and
  work-hours-visibility as dropdowns, "Save permissions" calling `PATCH /roles/:id/permissions`.
- "New role" modal: id/label/group fields + the same permission checkbox grid, calling `POST /roles`.
- Gated in `navConfig.ts` by the new `manageRoles` field ("Roles & permissions" nav item, admin-only by
  default). `frontend/src/types/permissions.ts` (the manual backend mirror) and the read-only
  `RoleMatrixModal.tsx` both updated with the new field.
- Verified live end-to-end via curl before writing the UI: created a custom `release_manager` role,
  created a user with it, logged in and confirmed the JWT's permissions payload matched exactly what was
  configured; edited the role's permissions and confirmed a fresh login reflected the change with no
  backend restart.

### Added — tests
- `e2e/tests/roles-admin.spec.ts` — Admin sees the nav item, Director doesn't; creating a custom role with
  chosen permissions shows it in the list; editing an existing role's permissions and reloading confirms
  the change persisted server-side (not just local state).
- `e2e/tests/role-sweep.spec.ts` — updated Admin's expected nav-item list to include "Roles & permissions".

## 2026-07-27 — Backlog → Jira-style roadmap (requirement-to-deployment tracking)

User feedback: "the developer, project manager and QA should have complete project or requirement end to
end tracking from requirement added to planning to implementation to development to testing to deployment,
creating epics and stories and stuff like jira and tracking of all." Epic/Story creation and linkage
already existed (`CreateTicketModal`'s Type=Epic/Story + Parent Epic picker, `parentTicketId` self-relation
on `Ticket`) — what was missing was visualizing progress through the pipeline. No schema changes; this is
a display-only upgrade over data that already exists.

### Changed — `frontend/src/pages/Backlog.tsx`
- Added a display-only **stage** derived from each ticket's existing `status` (no new field): Planning
  (Open/Assigned) → Development (InProgress/Reopened) → Testing (InReview/QATesting) → Deployed
  (Completed/Closed) — the requirement→planning→implementation→testing→deployment flow asked for.
- New **"Roadmap — requirement to deployment"** summary panel at the top: a stage-count row across every
  Story/Epic in the selected project, giving a swimlane-style at-a-glance view without a full
  drag-and-drop rebuild.
- Each **Epic** now shows a completion progress bar ("X/Y done", % complete — done = linked Stories in the
  Deployed stage) and a row of stage-breakdown chips (e.g. "2 Planning · 1 Testing"), plus a stage chip on
  the Epic's own header reflecting the Epic ticket's own status.
- Each Story/Epic row in the flat list also gets its stage chip alongside the existing priority chip.
- Drag-to-reorder (`backlogRank`) and Epic/Story grouping are unchanged — this only adds a visualization
  layer on top.

### Added — tests
- `e2e/tests/backlog-roadmap.spec.ts` — creates an Epic + linked Story, verifies the roadmap summary shows
  all four stage labels, and the Epic shows "0/1 done" with a "1 Planning" stage chip for its unstarted
  Story.

## 2026-07-27 — Leadership visibility: Analytics for Director/PM/Lead/Manager

User feedback: "the activity and visibility of all tickets, time used should have for project manager
admin director, leads and managers." Analytics (`adminAnalytics` permission) was Admin-only; widened to
the rest of the leadership tier, with a real scoping bug fixed along the way so Leads/Managers only ever
see their own team's data.

### Changed — `backend/src/common/permissions/role-permissions.ts`
- `director` and `pm` now have `adminAnalytics: true` (previously the only `false` in an otherwise
  org-wide-scoped role, which made no sense — they already saw Dashboard and Projects org-wide).

### Changed — `backend/src/common/permissions/effective-permissions.ts`
- The Lead/Manager seniority override now also sets `adminAnalytics: true` (was explicitly `false`) —
  they get Analytics too, but scoped to their team via the fix below, same as their `dashboard`/`projects`
  access already was.

### Fixed — `backend/src/analytics/analytics.service.ts` + `analytics.controller.ts`
- **`projectWise()` had no user/perms scoping at all** — it queried every project in the database
  unconditionally, regardless of who called it. This was silently safe only because the endpoint used to
  be Admin-only (`scope: 'all'` sees everything anyway); the moment Lead/Manager (`scope: 'team'`) gained
  the `adminAnalytics` permission above, this would have leaked every other team's project data to them.
  Fixed to take `(user, perms)` and filter `where: perms.scope === 'team' ? { teamId: { in:
  user.ledTeamIds } } : {}` — the exact same pattern `ProjectsService.findAll()` already uses for the
  Projects page. `productivity()` and `trend()` were already correctly scoped via `ticketVisibilityWhere()`
  and needed no change.
- Verified live via curl: Director/PM logins see every project (including a stray project a Lead doesn't
  lead); the Lead login (`vkapoor@elevatohub.io`, leads "Delivery Squad" → ATLAS only) sees exactly one row,
  ATLAS; Client still gets a 403.

### Added — tests
- `e2e/tests/leadership-analytics-visibility.spec.ts` — Director sees Analytics in the nav with real data;
  Lead's project-wise table contains only their own team's project(s); Client still has no Analytics nav
  item.
- `e2e/tests/role-sweep.spec.ts` — updated Director/Project Manager/Lead's expected nav-item lists to
  include "Analytics" (the assertion was asserting the old, narrower access on purpose — updated to match
  the new intended behavior, not loosened).

## 2026-07-27 — Client ticket-raising experience fixes

Part of the same feedback pass as the Dashboard/Analytics split below — "improve ticket raising platform to
client." An architecture-survey pass over `CreateTicketModal.tsx` had already flagged several real bugs in
the client-facing flow; fixed them here.

### Fixed — `frontend/src/components/tickets/CreateTicketModal.tsx`
- **Wrong "Raised via" default for every non-`'all'`-scope role.** The read-only source field was
  hardcoded to `'CallCenter'` for anyone without full access — including Clients, who should default to
  `'ClientPortal'`, and Customer Success/Operations, who should default to their own channel. Added a
  frontend `SOURCE_BY_ROLE` map mirroring the backend's (`common/permissions/role-permissions.ts`), keyed
  off `user.role.id`, so the displayed value now actually matches what `ticketVisibilityWhere()` scopes
  their own tickets by.
- **Internal staff name leak.** The watcher picker rendered every org user's name to whoever opened the
  modal — including Clients, who have no business seeing internal staff names. Hidden entirely for
  `scope === 'reporter'`; still shown for internal roles (including source-scoped field teams) who
  legitimately use it to loop in colleagues.
- **Hard page reload instead of SPA navigation.** `submit()` called `window.location.assign()` after
  creating a ticket, forcing a full reload (re-fetching the JS bundle, re-running auth bootstrap) just to
  land on the new ticket's detail page. Switched to `useNavigate()`.
- **No SLA visibility at creation time.** A client raising a ticket had no idea what response/resolution
  time to expect. Added a `field-note` banner showing the best-matching SLA policy's first-response and
  resolution targets (`slaPoliciesApi.list()`, matched by project + priority, preferring the most specific
  match) whenever one applies to the current project/priority selection — shown to every role, not just
  clients, since it's useful context for internal staff too.

### Fixed — `frontend/src/pages/TicketsList.tsx`
- The client-only KPI row (Tickets raised / Open / Closed / Reopened) was computed entirely from the
  `pageSize: 100`-capped ticket fetch, so a client with more than 100 tickets would see an undercount with
  no indication it was truncated. Reporter-scope requests now fetch `pageSize: 1000` instead of 100 (a
  client's own ticket volume doesn't approach org-wide scale, so this stays cheap), and "Tickets raised"
  now reads the server-computed `total` rather than `tickets.length`.

### Fixed — mobile horizontal-overflow flake (`e2e/tests/ui-improvements.spec.ts`)
Found while regression-testing the above: the "no horizontal overflow" mobile test flaked intermittently
(~1 in 3 runs) on `/tickets` and `/kanban`, always at the same overflow width regardless of page — pointing
at the shared app shell, not page content. `.content` (`frontend/src/styles/global.css`) is a flex child of
`.main` (`display:flex; flex-direction:column`) but only `.main` itself had `min-width: 0` — the classic
flexbox "child won't shrink below its content's min-content width" gotcha. Added `min-width: 0` to
`.content` too. The remaining timing component (full `page.goto()` reloads under Vite's dev-mode JS-injected
stylesheet can paint a frame before the mobile `.sidebar` `position: fixed` rule applies) is addressed in
the test itself by waiting for the sidebar to be off-canvas before measuring, rather than loosening the
assertion.

### Added — tests
- `e2e/tests/client-ticket-experience.spec.ts` — Client role sees `ClientPortal` as the read-only source
  value (not `CallCenter`), the watcher picker is absent, selecting a priority with a matching SLA policy
  shows the expected-response note, and creating a ticket lands on its detail page via SPA navigation
  (verified via a `window` marker that a hard reload would wipe).

## 2026-07-27 — Dashboard vs. Analytics differentiation

User feedback: Dashboard and Analytics felt like "more or less the same info" — several panels (Trend
summary chart, full-org client-raised stats, uncapped label breakdown) were duplicated verbatim across
both pages. Split them into two distinct products: Dashboard is now a capped "operational pulse" (always
top-5/10, with a "View all →" link into Analytics when a list is truncated); Analytics is the uncapped
"deep reporting" view with panels that don't exist anywhere on Dashboard.

### Changed — Dashboard.tsx (`frontend/src/pages/Dashboard.tsx`)
- Team workload: was an inline `.slice(0, 8)`, now a named `WORKLOAD_LIMIT = 5` with a "View all →" link
  to `/analytics` when the full list is longer.
- Project health: now sorted by overdue ratio descending (previously unsorted) and capped at
  `HEALTH_LIMIT = 10`, with a "View all →" link.
- Upcoming due dates: was `.slice(0, 6)`, now `DUE_LIMIT = 5` with a "View all →" link to `/tickets`.
- Ticket ageing by project: now sorted by total open count descending and capped at `AGING_LIMIT = 10`,
  with a "View all →" link.
- Recent activity: was unbounded, now `ACTIVITY_LIMIT = 5` with a "View all →" link to `/comms`.
- `LabelBreakdown` (`frontend/src/components/dashboard/LabelBreakdown.tsx`) gained optional `limit` and
  `onViewAll` props — Dashboard passes `limit={5}` and links to `/analytics`; Analytics keeps it uncapped
  (no `limit` prop) as the detailed counterpart.
- New shared `.panel-link` style (`frontend/src/styles/global.css`) for the "View all N →" pattern used
  across every capped panel above.

### Changed — Analytics.tsx (`frontend/src/pages/Analytics.tsx`)
- **Removed** the Trend summary chart — it's Dashboard-exclusive now (Dashboard's version is already
  project-filter-aware; Analytics' copy was a plain unfiltered duplicate).
- **Reworked** "Client-raised tickets" from an org-wide 3-stat block (which just duplicated Dashboard's
  "Raised by source" panel) into a **per-project client-raised breakdown table**, top 10 projects by
  volume — genuinely new information, not a re-statement of the Dashboard KPI.
- **Added** "Resolution time by priority" — a new bar chart showing average days from creation to close
  (Completed/Closed tickets only) per priority level, computed client-side from tickets Analytics already
  fetches. No backend change needed.
- Developer productivity, Hours by business category, and Project-wise performance (CSV export) are
  unchanged — they were already Analytics-exclusive.

### Fixed
- `phase11-audit.spec.ts`'s "Analytics page shows the Trend summary..." test was asserting the old
  duplicated-panel behavior this change deliberately removes; updated it to check for the panels that
  actually belong to Analytics now (assertion was wrong, not the app).
- `phase2e-audit.spec.ts`'s QA test-case test picked "whatever ticket is first in the tickets table" —
  not isolated from other e2e runs' leftover data, so a stray ad-hoc `E2E...` project's ticket (never
  cleaned up by `prisma/seed.ts`, which only resets tickets under its own known seeded projects) kept
  accumulating test cases across every suite run, eventually landing first in the list and breaking the
  "X/X passing" assertion. Test now creates and uses its own fresh ticket instead of relying on table
  order. Removed the accumulated stray project/tickets from the dev DB as a one-time cleanup.
- Team Hours "today" view needed another `npm run seed` re-run — see the existing 2026-07-24 entry below;
  this is a recurring characteristic of day-relative seed data, not a new bug.

### Added — tests
- `e2e/tests/dashboard-analytics-split.spec.ts` — covers: Dashboard's label breakdown is capped at 5 with
  a working "View all" link into Analytics; the Trend chart no longer appears on Analytics; Analytics
  shows the new per-project client-raised table and resolution-time-by-priority chart; Team workload and
  Recent activity stay capped at 5 rows on Dashboard.

## 2026-07-24 — UI improvement pass: responsive/mobile, accessibility, visual polish

User feedback: "improve UI" — responsive/mobile, accessibility, and overall look and feel including
dashboard colors. Since the app previously assumed a fixed desktop-width layout everywhere and had a
couple of accessibility gaps `designsystem.md` §10 had already flagged but never closed, this pass covers all three areas rather than picking one.

### Added — responsive / mobile
- **Off-canvas sidebar drawer below 900px** — the sidebar was a permanently-visible 216px column with no
  mobile treatment at all. `Sidebar.tsx` now accepts `open`/`onClose`; below the breakpoint it's
  `position: fixed`, slides in via `transform`, and is dismissed by a backdrop click, the new `X` close
  button, or by navigating (clicking any nav link auto-closes it). `Topbar.tsx` gained a hamburger
  (`.menu-btn`, hidden on desktop) that opens it; `AppShell.tsx` owns the `sidebarOpen` state.
- **Fluid grids** — `.kpi-grid`, `.proj-grid`, `.att-grid`, and `.integ-grid` switched from fixed
  `repeat(N, 1fr)` column counts to `auto-fit`/`auto-fill` with `minmax()`, so they reflow naturally at
  any width instead of squeezing N equal columns into a phone screen. `.row-2`/`.row-2b` (dashboard
  two-column panels), `.form-grid`, and `.td-meta-grid` stack to a single column under 900px. `.kanban`
  switches from 5 fixed columns to a horizontally-scrolling row of ~82vw-wide columns with scroll-snap
  below 900px, rather than trying to render 5 columns on a 390px screen.
- **Modals go near-full-screen below 900px** — anchored to the bottom of the viewport with a top radius
  only, instead of a centered box that would otherwise overflow a phone screen at its desktop max-width.
- **Topbar simplifies further below 600px** — search box hides (space-constrained; still reachable via
  desktop/tablet), the "New ticket" button's text label hides behind a new `.btn-label` class (icon-only,
  `aria-label` kept), the project-filter `<select>` shrinks, and the account-menu name/role text hides
  (avatar + chevron remain, still fully functional).
- `e2e/tests/ui-improvements.spec.ts` — new tests: desktop keeps the sidebar always-visible with no
  hamburger, mobile starts with the sidebar hidden and the hamburger opens it as a drawer, the backdrop
  and nav-link-click both close it, and Dashboard/Tickets/Kanban have zero horizontal overflow at a
  390px viewport width.

### Fixed — accessibility (designsystem.md §10's own flagged gaps)
- **Focus outlines were being suppressed.** `.search-box input`, `.proj-select`, and every `.field`
  input/select/textarea explicitly set `outline: none` with nothing restoring it for keyboard focus —
  exactly the gap §10 called out ("must be paired with a visible focus outline... the prototype omits
  browser default outlines... this is a gap to close before ship"). Added a global
  `:focus-visible { outline: 2px solid var(--brand) }` rule (lime on the dark sidebar) placed late in the
  cascade so it wins the specificity tie against those earlier rules.
- **Several interactive controls were non-focusable `<div>`/`<span>` elements with only `onClick`** —
  invisible to keyboard and screen-reader users entirely (no Tab stop, no way to activate via
  Enter/Space). Converted to real `<button>` elements with `aria-label`/`aria-pressed`/`aria-expanded`
  as appropriate: the notification bell, the topbar account-menu ("role switcher") and its sign-out item,
  watcher/project-member picker chips (`CreateTicketModal`, `CreateProjectModal`), the SLA document
  download chip, and the Team Hours "view history" row. The `AttachmentUploader` dropzone (used on ticket
  creation, ticket detail, project documents, and QA evidence) gained `role="button"`, `tabIndex={0}`,
  and Enter/Space handling — it was a `<div onClick>` with a hidden file input that a mouse user could
  click but a keyboard user could never reach.
- **Form labels weren't programmatically associated with their inputs** (`<label>Text</label>` as a
  bare sibling of the `<input>`, no `htmlFor`/`id`) — a screen reader announces such an input with no
  accessible name at all. Fixed on every field in `CreateTicketModal`, `CreateProjectModal`,
  `TicketDetail`'s edit-mode fields (including the metadata-panel selects, which used a plain `<div>`
  for their label with no association whatsoever), `Users.tsx`'s add-user form and per-row role select,
  `SlaPolicies.tsx`'s create-policy form, and `WorkHours.tsx`'s date/member filters. (`Login.tsx` already
  had this right — used as the reference pattern for the rest.)
- **Low priority chip was a borderline WCAG AA contrast fail** — `designsystem.md` §10 flagged this
  explicitly ("Low priority gray-on-gray... should be re-checked"). `PRIORITY_COLOR.Low` (and the
  matching `--low` token, and `StatusDot`'s default gray) darkened from `#7C8598` to `#5B6472` — same
  neutral-gray identity, now readable at chip size. Table header text (`.data-table th`, `.aging-table
  th`, `.perm-table th`) darkened from `--ink-faint` to `--ink-soft` for the same reason — column headers
  are informational, not decorative, and were failing contrast against their `--surface-2`/white
  backgrounds.
- **Known remaining gap, not closed in this pass:** a full token-level contrast audit of every
  `--ink-faint` usage (timestamps, sub-labels, placeholder-style metadata — ~20 call sites) against every
  background it appears on. The two clearest, highest-traffic failures (Low priority, table headers) are
  fixed; the rest is lower-contrast secondary metadata by design and would need a case-by-case check
  rather than a blanket token change, which risks flattening the app's whole visual hierarchy.

### Changed — visual polish
- **KPI cards** gained a tone-colored top border accent (`.kpi-{ink,red,amber,green,brand}`) — a quick
  color cue for what kind of number a KPI is, beyond just the icon tint, without going louder than the
  design system's "dense but calm" principle.
- **Empty states** now render as a dashed-border, tinted box (`.empty-state`) instead of plain centered
  gray text, matching the existing "instructive, not apologetic" voice guideline with a bit more visual
  presence. **Error states** got a tinted background for the same reason.

### Data
- Re-ran `backend/prisma/seed.ts` — the demo dataset's day-relative fields (Team Hours "today", ticket
  ageing, trend buckets) are computed relative to wall-clock time at seed time, and enough real time had
  passed since the last seed that "today" had zero data, which is what actually surfaced during this
  pass's Playwright run (not a UI regression — a stale-seed artifact). Not a code fix, just a reminder
  that this dataset needs a periodic re-seed for demo freshness, same as any day-relative fixture.

Full suite: 66/66 passing.

## 2026-07-23 — PRD Phase 2e: project access control, SLA documents, QA testing module

Completes `docs/prd-phase2.md` — Phase 2e, the largest slice by design (a new permission axis plus a new
child-table-heavy module), sequenced last on purpose rather than because it mattered least.

### Added
- **Project-level access control** — a new `ProjectMember` model, a genuinely new axis on top of the
  existing role-scope model rather than a bolt-on. Admin/Director/PM and Lead/Manager-seniority tiers
  always see every project their role-scope already allows; individual-contributor tiers
  (Senior/Junior Developer, Intern, QA) only see a project if they're an explicit member **once that
  project has at least one member configured** — a project with zero members stays open to everyone, so
  this can never silently lock anyone out of a pre-existing project the moment it shipped. Enforced in
  both `ProjectsService.findAll()` (list) and `findOne()` (direct fetch — previously *completely
  unscoped*, any authenticated user could fetch any project by code; this closes that gap too).
  `CreateProjectModal` gets an optional member picker; `ProjectDetail` gets a "Manage access" section
  (Admin or the project's own PM can add/remove members — matches the server-side check in
  `ProjectsService.addMember()`). Verified live: a non-member Developer gets a 404 on both the list and
  direct fetch of a restricted project; the member, Admin, and the PM all see it fine; an existing project
  with no configured members stays visible to everyone, as designed.
- **SLA policy document upload** — `SlaPolicy` gains `documentFileName`/`documentFileSize`/
  `documentMimeKind`/`documentStorageKey`, same signed-URL pattern as every other attachment in the app.
  `SlaPolicies.tsx` shows an "Attach" control per policy row that becomes a downloadable chip once a
  document exists.
- **SLA bulk CSV import UI** — the backend endpoint (`POST /sla-policies/bulk-upload`) already existed,
  fully working, with zero UI wired to it. New `components/sla/BulkUploadSlaModal.tsx`: pick a `.csv`,
  see a row-by-row validation preview (valid/invalid with reasons) before committing anything, then
  import only the valid rows.
- **QA testing module** — the original `prd.md` §4.2 scoped this ("QA fields: Test case ID/link,
  Environment, Pass/Fail, Regression flag") but it was never built; `CHANGELOG.md` had it flagged as a
  known gap. New `TicketTestCase` child table (not `TicketCustomField` key/value rows — a test case needs
  its own pass/fail/executedBy/executedAt history, which key/value pairs can't model cleanly): add test
  cases with steps/expected result, record pass/fail/blocked results, flag regressions. Evidence uploads
  (screenshots/recordings/logs) reuse the existing `TicketAttachment` pipeline with a new nullable
  `context` column (`'qa'`) so they render grouped separately from general attachments instead of a
  parallel upload path. New `components/tickets/QaTestCasesPanel.tsx` on `TicketDetail.tsx`.
- `e2e/tests/phase2e-audit.spec.ts` — 4 new tests: creating a project with a restricted member shows the
  Manage access section reflecting it, attaching a document to an SLA policy shows it as a downloadable
  chip, the bulk CSV import preview/commit flow works end to end, and adding + passing a QA test case
  updates the pass count. Full suite: 61/61 passing.

### Fixed
- **`SlaPoliciesService.findAll()` had no `orderBy`** — harmless until a row got updated (e.g. attaching a
  document), at which point Postgres's unordered scan could return that row in a different position than
  before, making the whole table visibly reshuffle in the UI on every edit. Added `orderBy: { createdAt:
  'asc' }`. Found while writing the SLA document-upload test, whose row-position assumption broke on the
  first real edit — fixed the assumption in the test *and* the underlying non-deterministic ordering, since
  the same reshuffle would have confused a real user clicking "Attach" too.
- `e2e/tests/attachments.spec.ts`'s ticket-attachment test used an unscoped `input[type=file]` locator,
  which broke the moment `TicketDetail.tsx` gained a second upload area (QA evidence, same page) — scoped
  it to the general Attachments panel specifically.
