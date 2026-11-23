# Product Requirements Document — Phase 2

## ElevatoHub — Editability, Auditability, Deeper Analytics & Access Control

**Status:** Draft v1.0
**Owner:** Product Management
**Relationship to `prd.md`:** That document is the original v1 scope, now largely built (see
`CHANGELOG.md`). This document captures a second round of gaps raised directly against the running
app — real usage surfaced things a spec review wouldn't have. Each section states the **current
state** (with file references) and the **requirement**, so nothing here is guesswork about what
already exists.

---

## 0. Source of this document

Consolidated from a single feedback pass across the live app: global search, ticket creation, ticket
detail layout and edit rules, audit logging, ageing definition, timer precision, Epic/Story linkage,
analytics depth, a new Business Category field, Team Hours drill-down, CSV export, SLA document
upload, project-specific views, project-level access control, and a QA testing module. Given the
size, this is scoped as a phased delivery (Section 15), not a single change.

---

## 1. Global Search

**Current state:** `frontend/src/components/layout/Topbar.tsx` renders a search box that is
hard-coded `disabled` — `<input ... disabled title="Search is not wired up in this scaffold yet" />`.
It has never done anything.

**Requirement:**
- Search across tickets (title, description, `displayId`), projects (name, code), and people (name,
  email), scoped by the searching user's existing ticket/project visibility (never bypass
  `ticketVisibilityWhere()`).
- Debounced type-ahead dropdown under the search box grouped by result type (Tickets / Projects /
  People), each row deep-linking to the relevant detail page.
- New backend endpoint, e.g. `GET /search?q=`, doing three scoped queries (Postgres `ILIKE` is
  sufficient at current data volume — no need for a search engine yet).

---

## 2. Ticket Creation

### 2.1 Attachments at creation time

**Current state:** `frontend/src/components/tickets/CreateTicketModal.tsx` has no file upload field
at all — `AttachmentUploader` only exists on `TicketDetail.tsx` and `ProjectDetail.tsx`, so a file can
only be attached *after* the ticket already exists.

**Requirement:** Add the same `AttachmentUploader` component to the Create Ticket modal. Since the
ticket doesn't have an `id` yet, upload files to a temporary staging key first
(`storage.buildStorageKey('staging', tempId, fileName)`), then on successful ticket creation call
`POST /tickets/:id/attachments` once per staged file to attach them — same pattern
`ProjectDetail`/`TicketDetail` already use for post-creation uploads, just sequenced after the create
call instead of standalone.

### 2.2 Downloads

**Current state:** Downloads already work end-to-end via signed URLs
(`AttachmentGrid` → `getDownloadUrl` → MinIO presigned GET, see `CHANGELOG.md` 2026-07-22). No known
gap here beyond 2.1 (files uploaded during creation need to reach the same attachment record so they
become downloadable through the existing path).

### 2.3 Epic / Story linkage

**Current state:** The data model already supports a parent/child relationship —
`Ticket.parentTicketId` and the `children` relation exist in `schema.prisma` (lines 262, 285–286) —
but nothing in the API or UI ever reads or writes it. `CreateTicketModal` has a flat `Type` dropdown
(`Story | Epic | Bug | Feature | Enhancement | Task | ChangeRequest | Support`) with no way to say
"this Story belongs to that Epic."

**Requirement:**
- When `Type = Story`, show a "Parent Epic" selector (tickets of `type: Epic` in the same project).
- `CreateTicketDto` gains an optional `parentTicketId`.
- `Backlog.tsx` groups Stories under their Epic (already noted as a goal in `prd.md` §4.1, "groupable
  by Epic" — never implemented) instead of one flat list.
- Ticket detail shows "Part of: EPIC-CODE — title" (linked) when a ticket has a parent, and a
  "Sub-tasks" list when it has children — mirrors the reference SR-tool screenshot's Sub-Tasks section.

### 2.4 Business Category field (new)

**Requirement:**
- New field on `Ticket`: `businessCategory`, one of **InnovateX**, **ElevatozX**, **AccquareX**.
- **Required** at creation for Customer Success, Project Manager, and Developer roles; optional/hidden
  for other roles (Call Center, Operations, Client, QA) unless product decides otherwise — flag as an
  open question (Section 16).
- Schema: new `BusinessCategory` enum + `businessCategory BusinessCategory?` column on `Ticket`.
- Powers a new analytics cut — see Section 6.4.

---

## 3. Ticket Detail — Layout, Editing, and Audit Trail

### 3.1 Layout

**Current state:** `TicketDetail.tsx` renders as a centered `.modal`-style panel capped at
`maxWidth: 820`, with nothing to its right — matches the first screenshot you attached (title bar,
metadata grid, description, watchers, attachments, comments, activity, all in one narrow column, empty
space to the right on any screen wider than ~900px).

**Recommendation:** Go full-width, two-pane — not just "fill the empty space" but restructure like the
reference SR-tool screenshot:
- **Left pane (primary, ~70%):** title, description, sub-tasks/children, comments — the content that's
  read and edited most.
- **Right pane (~30%, sticky):** the metadata block (status, priority, assignee, dates, business
  category), watchers, time tracking, attachments, and — new — the **audit/change log** (Section 3.3).
- This also gives the modification log (which will get long) a natural home without pushing comments
  further down the page, and matches the layout convention already established by the reference tool
  you're benchmarking against. Treat this as a page (`/tickets/:id` already is one), not a modal overlay
  — the current `.modal`-style chrome (X-close, `maxWidth`) is a leftover from when it may have been
  designed as an overlay; a detail page benefits more from breathing room than from modal framing.

### 3.2 Edit permissions, gated by status

**Current state:** There is no edit capability at all today — `TicketDetail.tsx` can change `status`,
add comments/watchers/attachments, and toggle the timer, but title/description/priority/label/due
date/assignee are all read-only after creation, for every role, in every status.

**Requirement:**
- **When `status === 'Open'`:** the ticket's reporter, any full-access role (`scope: 'all'` or
  `'team'`), and Admin can edit title, description, priority, label, due date, assignee, and (once built)
  Business Category directly in place.
- **Once status leaves Open** (Assigned, InProgress, InReview, QATesting, Completed, Closed,
  Reopened): title and description become **read-only for everyone, including Admin**. Any further
  change to what the work *is* must go through a comment, not a silent field edit — preserves the
  description as a record of what was originally asked for. Status itself, and comments, remain
  editable regardless of status (unaffected by this rule).
- **Reopened is a return to Open for editing purposes** — reopening should re-enable the same edit
  rights as Open, since re-opening implies the description may legitimately need correcting before work
  resumes.
- Server-side enforcement: `TicketsService` needs a new `PATCH /tickets/:id` handling exactly this
  field set, rejecting title/description changes when `ticket.status !== 'Open'` and `!== 'Reopened'`
  regardless of what the client sends — this cannot be a UI-only restriction (matches the project's
  existing "server enforces, never client-only" rule from `CLAUDE.md`'s permission-model section, just
  applied to a new axis: ticket status, not user role).

### 3.3 Field-level modification log ("who changed what, and when")

**Current state:** `ActivityLogEntry` (schema.prisma lines 418–433) stores a single freeform
`actionText` string per event (e.g. "assigned this to P. Manager") — there is no structured record of
*which field* changed, or its *old and new value*. `createdAt`/`updatedAt` exist on `Ticket` already
and are returned by the API, but nothing surfaces "Modified" as a labeled fact the way the reference
SR-tool screenshot does (`Created: ... / Modified: ... / Moved: ...`).

**Requirement:**
- New `TicketFieldChange` model: `ticketId`, `changedBy`, `fieldName`, `oldValue`, `newValue`,
  `changedAt`. Written alongside (not instead of) the existing `ActivityLogEntry` text log — the text
  log stays good for a human-readable feed, this is for a structured "show me exactly what changed"
  view.
- Every field edit (Section 3.2), status change, assignee change, and reopen writes a row here.
- Ticket detail's right pane (Section 3.1) gets a "Change history" list, one line per field change:
  `{field} changed from "{old}" to "{new}" by {who} · {when}` — this is the "full modification log"
  you asked for, distinct from the existing free-text Activity feed.
- Surface `Created` and `Modified` (from `Ticket.createdAt`/`updatedAt`, already in the API response)
  in the metadata block, matching the reference screenshot.

### 3.4 Ageing definition

**Current state:** `ageingBucket()` (`Dashboard.tsx`) and its backend equivalents bucket every open
ticket purely by `daysBetween(t.createdAt, now)` — a ticket that was actively worked on yesterday
ages identically to one that's been silently sitting for the same number of days since creation.

**Requirement:** Ageing should reflect **staleness**, not just age since creation. Redefine the bucketing
input as `daysBetween(t.updatedAt, now)` for "time since last touched," and keep a second, separate
"total age" metric as `daysBetween(t.createdAt, now)`. Show both on the ticket list (already has an Age
column, per `CHANGELOG.md` 2026-07-23 phase-11 audit) — split it into **Age** (since created) and
**Idle** (since last modified) — and use **Idle** (staleness), not raw Age, for the SLA-risk-flavored
"is this ticket stuck" framing the ageing heatmap communicates. `updatedAt` already changes on any
field/status write, so this needs no new tracking, only a second bucketing pass.

---

## 4. Backlog page — what it's for (no code gap, just needs explaining)

You asked what the Backlog page's purpose is. Short answer: it's the **planning queue**, separate
from the Kanban board (the **execution view**). Concretely, today (`Backlog.tsx`):
- Lists every `Story`/`Epic`-type ticket in the selected project.
- Lets you drag to reorder them — that order is `backlogRank`, a sequencing field completely separate
  from the ticket's `Priority` (Critical/High/.../Low). Priority says *how severe*; backlog rank says
  *what order the team should pick things up in*, which often isn't the same thing (a Low-priority item
  might legitimately be next up because it's small and unblocks something else).
- It intentionally does **not** show Bug/Task/ChangeRequest/Support-type tickets — those are
  operational/reactive work, not planned feature work, so they don't belong in a "what should we build
  next, in what order" queue.
- With Section 2.3's Epic/Story linkage built, it'll additionally group Stories under their parent
  Epic, matching what `prd.md` §4.1 originally called for.
- If it isn't earning its place in your workflow once Epic/Story grouping lands, the alternative is
  folding it into a "Backlog" swimlane/filter on the Kanban board itself rather than a separate page —
  flagged as an open question (Section 16) rather than assumed.

---

## 5. Time Tracking — second-level precision

**Current state:** `TimeEntry.durationMinutes` (`schema.prisma` line 378) is an `Int` in minutes.
Anything under 60 seconds rounds to `0` and looks like nothing was logged.

**Requirement:**
- Change `durationMinutes` computation (`TicketsService` timer start/stop handlers) to compute and
  store `durationSeconds` instead (rename the column; this is a breaking schema change, needs a
  migration), deriving minutes for display via `Math.round(durationSeconds / 60)` everywhere minutes
  are shown today, but keeping seconds available for anything logged in a single short burst.
  Alternative that avoids a rename: keep `durationMinutes` but change its type to `Decimal` and store
  fractional minutes (e.g. `0.5` = 30s) — smaller migration, same end-user effect. Pick one during
  implementation; recommend the `Decimal` minutes approach for the smaller blast radius.
- `formatMinutes()` (currently duplicated ad hoc in `TicketsList.tsx` and the prototype) should show
  seconds for durations under 1 minute (e.g. "42s") instead of "0m".

---

## 6. Dashboards & Analytics

### 6.1 Ageing drill-down

**Current state:** The Dashboard's "Ticket ageing by project" heatmap (`Dashboard.tsx`) and Analytics'
project-wise table are read-only — clicking a cell does nothing.

**Requirement:** Clicking an ageing-bucket cell (or the SLA-breach-relevant buckets specifically, e.g.
"aged beyond SLA resolution target for its priority") navigates to `/tickets` pre-filtered to that
project and that ageing bucket (or, more usefully per your ask, specifically **tickets aged past their
SLA policy's resolution target**, once Section 3.4's Idle metric and the existing SLA policy data are
cross-referenced). Needs a `TicketQuery` filter param, e.g. `agedBeyondSla=true`, applied server-side
alongside the existing filters in `TicketsService.findAll()`.

### 6.2 Reporting cadence

**Current state:** Trend panel (`Dashboard.tsx`, `Analytics.tsx`) already supports Month/Quarter/Year
toggle via `analyticsApi.trend(period)` — this part is already built per `prd.md` §12. No gap here
beyond what Section 6.4 adds as a new cut.

### 6.3 Developer productivity & total-hours analytics (new)

**Requirement — new "Productivity" analytics panel:**
- **Org total hours spent** — sum of all `TimeEntry` duration in the selected period.
- **Per-developer summary table**: name, total hours logged, number of distinct tickets worked on, in
  the selected period — the "who did how much, on how many things" view you asked for.
- **Project-wise summary**: per project — total tickets, open, closed, aged (Idle > some threshold),
  and total hours spent — extends the existing `analyticsApi.projectWise()` table
  (`ProjectWiseRow` in `frontend/src/api/analytics.ts`) with an `hoursSpent` column, computed
  server-side as `SUM(time_entries.duration) WHERE ticket.project_id = X`.
- Audience: same as existing Admin analytics — Admin, Director, PM, Lead (team-scoped).

### 6.4 Business Category analytics (new, depends on Section 2.4)

**Requirement:** Once `businessCategory` exists on `Ticket`, add a panel — Analytics page — breaking
down total hours spent (and ticket counts) by **InnovateX / ElevatozX / AccquareX**, same
period-toggle pattern as the existing Trend panel. This is the "which business vertical is eating our
time" view you described.

### 6.5 Client vs. helpdesk raised split + label summary on Dashboard

**Current state:** `LabelBreakdown` (recurring issue categories) already exists on the Dashboard.
There is no client-vs-internal-source split shown there today — `Analytics.tsx` has a client-raised
rollup, but it's on a separate admin-only page, not the main Dashboard.

**Requirement:** Add a small panel to the Dashboard — "Raised by source" — splitting ticket volume into
**Client Portal** vs. **internal/helpdesk sources** (Call Center, Customer Success, Operations,
Internal/PM, Sales grouped together), so this is visible to any `dashboard`-permission role, not just
Admin on the Analytics page.

---

## 7. Kanban — project-specific board

**Current state:** As of the `CHANGELOG.md` 2026-07-23 phase-11 audit, the Kanban board already reads
the global topbar project filter (`ProjectFilterContext`) and scopes itself when a project is selected
there — this partially satisfies the ask already.

**Requirement (the remaining gap):** `ProjectDetail.tsx` should get a **"View board"** action next to
the existing "View in dashboard" button (added in the same phase-11 batch), which sets the global
project filter to that project's code and navigates to `/kanban` — so "select a project → see its
board" is a direct one-click path from the project page, not something you have to discover via the
topbar dropdown separately.

---

## 8. Team Hours

**Current state:** `WorkHours.tsx` shows a single day (date picker defaults to today, one day at a
time), for whichever users the viewer's `workHoursVisibility` permits (`none`/`own`/`team`/`org`). No
range picker, no per-member drill-down, despite the code comment on line 4–6 already flagging this as
a known gap ("Click-through drill-down ... available via `workHoursApi.drillDown` but not wired into
this simplified table yet" — so a backend drill-down endpoint may already exist and just needs a UI).

**Requirement:**
- Replace the single date picker with a **date-range picker** (start/end) for Admin, Director, Tech
  Lead, PM, and Tech/Engineering Manager (i.e. `workHoursVisibility: 'org'` or `'team'` roles) — other
  roles keep the current-day-only view.
- Add a **member filter** — "All" (current behavior) or a specific person — for the same
  `org`/`team`-visibility roles.
- Add a **"View history"** button per row that opens a drawer/modal listing every ticket that person
  logged time against in the selected range: ticket `displayId`, title, and hours — exactly the three
  columns you asked for, nothing more.
- Confirm whether `workHoursApi.drillDown` (referenced in the existing code comment) already exists
  server-side before building a new endpoint — check `backend/src/reports/` before assuming greenfield.

---

## 9. CSV Export (cross-cutting)

**Requirement:** Add a "Export CSV" action to every tabular/report view this phase touches or already
has: Ticket list, Team Hours (+ the new per-member history drawer), Analytics' project-wise and
productivity tables, SLA policies. Implement as one shared frontend helper
(`exportToCsv(filename, rows)`, client-side `Blob` download — no backend endpoint needed since these
are all already-fetched, already-paginated-away-from datasets) rather than one bespoke exporter per
page.

---

## 10. SLA Policies — document upload

**Current state:** `SlaPolicies.tsx` / `SlaPoliciesController` already support add/list/remove for
individual policy rows, and a bulk CSV/XLSX upload endpoint already exists server-side
(`POST /sla-policies/bulk-upload`, per the code comment at the top of `SlaPolicies.tsx`) but has no UI.

**Requirement:**
- Wire the existing bulk-upload endpoint into the SLA Policies page — an "Import from CSV/XLSX" action
  with a validation/preview step before committing, per the original `prd.md` §9 spec (this was scoped
  before, just never built).
- **New, not previously scoped:** a **document upload** attached to an SLA policy record — e.g. the
  signed SLA agreement/contract PDF a policy is based on. Needs a small schema addition
  (`SlaPolicy` gains an optional `documentStorageKey`/`documentFileName`, same pattern as
  `ProjectDocument`) and reuses the existing `AttachmentUploader`/signed-URL machinery.

---

## 11. Project-level access control (new permission dimension)

**Current state:** Project visibility today is entirely **role-scope-based** —
`scope: 'all'` roles see every project, `scope: 'team'` (Lead) sees projects belonging to their led
team(s) (`ProjectsService.findAll()`, `where: perms.scope === 'team' ? { teamId: { in:
user.ledTeamIds } } : {}`). There is no concept of "this specific person was added to this specific
project" — membership is entirely implied by team.

**Requirement:**
- New `ProjectMember` model: `projectId`, `userId`, `addedBy`, `addedAt`.
- **Admin, Director, Lead, and Manager keep seeing all projects** (unchanged — matches your ask that
  these roles retain full visibility).
- For everyone else (Senior/Junior Developer, Intern, QA, PM when not also Director/Admin — confirm
  exact list, see Section 16), project visibility becomes: **role-scope filter AND (is a member of the
  project OR project has no member list set)** — the "no member list set" fallback keeps existing
  projects fully visible until someone deliberately restricts them, so this doesn't silently lock
  people out of every project that predates the feature.
- `CreateProjectModal` (and a new "Manage access" action on `ProjectDetail`) gets a member picker —
  **Admin or the assigned Project Manager** can add/remove members, matching your "who should create
  the project and manage its access" ask.
- This is a genuinely new axis on top of the existing role-scope model in
  `backend/src/common/permissions/ticket-scope.ts` / `role-permissions.ts` — needs careful design so it
  composes with, rather than fights, the existing `scope` enum. Worth a dedicated design pass before
  implementation, not a bolt-on.

---

## 12. QA Testing Module (new)

**Current state:** `TicketCustomField` (schema.prisma lines 307–318) already models exactly this shape
— `fieldGroup: qa` plus arbitrary key/value pairs — per the original `prd.md` §4.2 "QA fields:
Test case ID/link, Environment tested, Pass/Fail result, Regression flag." It has never been wired into
any UI (`CHANGELOG.md` explicitly lists this as an unaddressed gap from the original PRD).

**Requirement:** This phase is the point to finally build it, and extend it per your ask:
- QA-only ticket section (visible when the current user's role is QA, or always visible but
  QA-editable-only, per the original §4.2 design: "pinned open" for QA, collapsed-but-visible for
  others): add test cases (title, steps, expected result), record pass/fail results against them, flag
  regressions.
- **File upload for test evidence** (screenshots, recordings, logs) — reuse `AttachmentUploader` scoped
  to the ticket, tagged distinctly enough (e.g. a `context: 'qa'` field, or a naming convention in
  `storageKey`) that they can be visually grouped under the QA section instead of mixed into the general
  Attachments list.
- Given `TicketCustomField` is key/value, a small number of well-known keys covers the original spec's
  fields directly; **test cases with pass/fail history** need a proper child table
  (`TicketTestCase`: `ticketId`, `title`, `steps`, `expectedResult`, `status: pass|fail|blocked`,
  `executedBy`, `executedAt`) rather than being force-fit into key/value custom fields, since there can
  be many test cases per ticket with their own history.

---

## 13. Seed data

**Requirement:** Expand `backend/prisma/seed.ts` beyond the current single-sprint-shaped dataset so
the new analytics (quarterly/annual trend, per-developer productivity, business-category breakdown,
Team Hours history) have something meaningful to render — specifically: tickets and time entries
spread across multiple months (not all clustered around "today," as they are now), enough volume per
business category once that field exists, and a few Epics with real Story children to exercise Section
2.3.

---

## 14. Non-Functional Notes

- Section 3.2's status-gated edit rule and Section 11's project membership are both **new permission
  axes**, not additions to the existing role-scope model — both need server-side enforcement from the
  start (per `CLAUDE.md`'s standing rule), not UI-only gating that gets bolted onto later.
- Section 5's timer precision change is a schema migration on a table (`time_entries`) that likely has
  production-shaped data by the time this ships — write the migration to convert existing
  `durationMinutes` integers into the new representation losslessly, not just add a column and abandon
  the old one.
- Every new list/table this phase adds (change history, test cases, project members, business-category
  breakdown) should follow the same "server enforces the viewer's scope at the query level" discipline
  as `ticketVisibilityWhere()` — don't fetch broad and filter client-side.

---

## 15. Open Questions

1. **Business Category** — required for CS/PM/Developer at creation, per your ask. Should Call Center,
   Operations, Client, and QA be blocked from setting it (hidden field), or allowed but optional?
   Assumed: hidden/optional for now (Section 2.4).
2. **Project membership (Section 11)** — exact role list that gets membership-gated vs. always-sees-all.
   Assumed: Admin/Director/Lead/Manager always see all; PM sees all only if also holding one of those
   roles, otherwise membership-gated like Developer/QA/Intern. Confirm.
3. **Backlog page's future** (Section 4) — keep as a dedicated page once Epic/Story grouping lands, or
   fold into a Kanban swimlane? Leaning toward keeping it dedicated once grouping exists, since a
   swimlane view would fight the board's per-status column layout.
4. **Timer precision migration approach** (Section 5) — rename+reshape `durationMinutes` to
   `durationSeconds`, or keep the name and switch to `Decimal` minutes? Recommend the latter for a
   smaller migration; needs a decision before implementation starts.
5. **SLA "aged beyond SLA" drill-down** (Section 6.1) — should this also flag tickets that haven't
   technically breached yet but are in the `slaBreachRisk: 'high'` band, or strictly actual breaches
   only?

---

## 16. Suggested Delivery Phases

Given the size of this batch, sequencing it avoids shipping a dozen half-finished things at once.

| Phase | Scope | Why this grouping |
|---|---|---|
| **Phase 2a — Foundational fixes** | Global search, attachments at ticket creation, timer second-precision, Backlog Epic/Story grouping (Section 2.3, 5, 4) | Smallest, most self-contained; no new permission model needed. |
| **Phase 2b — Edit & audit** | Status-gated ticket editing, field-level change log, ticket detail layout rework, ageing split into Age/Idle (Section 3) | These four are tightly coupled — the layout rework is largely *for* the new audit panel, and Idle staleness depends on the same `updatedAt` discipline the edit-lock relies on. |
| **Phase 2c — Analytics depth** | Business Category field + its analytics, productivity/hours analytics, project-wise hours, client-vs-helpdesk split, ageing drill-down, expanded seed data (Section 2.4, 6, 13) | Depends on 2a/2b's data (edits, business category) being in place first to have something real to analyze. |
| **Phase 2d — Team Hours & CSV export** | Date-range picker, member filter, view-history drawer, CSV export everywhere (Section 8, 9) | Independent of the others; can run in parallel with 2c if resourced separately. |
| **Phase 2e — Access control & QA module** | Project membership model, SLA doc upload + bulk-upload UI, QA testing module (Section 10, 11, 12) | Largest design surface (a new permission axis, a new child-table-heavy module) — sequenced last deliberately, not because it matters least. |
