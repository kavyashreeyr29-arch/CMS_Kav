# Product Requirements Document

## ElevatoHub — Unified Project, Ticket & Team Intelligence Platform

**Status:** Draft v1.0
**Owner:** Product Management
**Prototype reference:** `pulse-dashboard.jsx` (interactive front-end concept, all data mocked)

---

## 0. Naming

You asked for the product to be renamed to "elevatozhub." I've cleaned this up to:

> ## **ElevatoHub**
> *"Elevate every ticket, project, and team."*

If you'd rather explore alternatives, here are three in the same spirit, in case one lands better with stakeholders or trademark search:

| Name | Rationale |
|---|---|
| **ElevatoHub** (recommended) | Closest to your original; reads cleanly, "Hub" signals the all-in-one control center positioning. |
| **Elevaite** | Blends "Elevate" + "AI," foregrounds the new AI-driven workflow layer (Section 13). |
| **Summit** | Short, brandable, evokes "reaching the top" without needing the AI/elevate wordplay. |

All references below use **ElevatoHub**. Internally the prototype's codename remains "Pulse" until the rename is executed across the codebase.

---

## 1. Summary

ElevatoHub is a unified project management, ticketing, and team-intelligence platform that merges the day-to-day usability of Trello, the issue-tracking rigor of Jira, the client-facing simplicity of Basecamp, and the scheduling backbone of MS Project — with a built-in, role-aware permission model and an emerging AI automation layer.

It serves five audiences from one system:
1. **Leadership** (Admin, Director) — portfolio-wide visibility and org configuration.
2. **Delivery team** (PM, Lead, Senior/Junior Developer, Intern, QA) — day-to-day execution, story/bug tracking, time logging.
3. **Field/intake teams** (Call Center, Customer Success, Operations) — fast ticket raising and team-scoped tracking.
4. **Clients** — self-service raise/track/close/reopen, with internal identities kept private.
5. **The system itself** — via a "bring your own AI" layer that automates categorization, summarization, and predictive alerts.

---

## 2. Goals & Non-Goals

**Goals**
- One system of record for tickets, projects, time, documents, and communications.
- Role-based access that scales from an external client with almost no visibility to an Admin with total control — without duplicating the UI per role.
- Give management provable visibility into SLA health, team capacity, and where issues are recurring.
- Let AI absorb repetitive triage work (categorization, summarization, first-pass replies) without locking the org into one AI vendor.

**Non-Goals (this phase)**
- Native mobile apps (responsive web only).
- Native calendar/email server (Outlook/Gmail sync is a fast-follow integration, not v1).
- Full double-entry billing/invoicing.
- Building a proprietary LLM — ElevatoHub orchestrates external AI providers, it does not train its own model.

---

## 3. Roles & Permission Model

### 3.1 Role list

| Role | Group | Ticket visibility | Notes |
|---|---|---|---|
| **Admin** | Full access | All | Full access + org configuration (users, labels, SLA, AI). |
| **Director** | Full access | All | Executive visibility, no configuration rights. |
| **Project Manager (PM)** | Full access | All | Full visibility, time tracking, story/bug creation. |
| **Lead** | Full access (team-scoped) | All tickets for their team(s) | Same dashboard shape as Director, scoped to the team(s) they lead. |
| **Senior Developer** | Full access | All (default: "My Tasks") | Time tracking, story/bug creation. |
| **Junior Developer** | Full access | All (default: "My Tasks") | Same as above; seniority is a label/filter, not a permission cut. |
| **Intern** | Full access, reduced | All (default: "My Tasks") | No delete rights; everything else same as Junior Developer. |
| **QA** | Full access | All (default: "My Tasks") | Time tracking, creates bugs/test tickets. |
| **Call Center Agent** | Field team | Own team's tickets (source = Call Center) | Raise, comment, update, close. Also has Projects access. |
| **Customer Success** | Field team | Own team's tickets (source = Customer Success) | Raise, comment, update, close, work the board. Projects + Board access. |
| **Operations** | Field team | Own team's tickets (source = Operations) | Raise, comment, update, close. |
| **Client** | External | Own tickets only (reporter = self) | Raise, comment, close, **reopen**. Assignee shown as department, not name. |

### 3.2 Seniority sub-roles (new)

Within the "Developer" umbrella, Admin can tag each user with a **seniority level**: `Lead`, `Manager`, `Senior Developer`, `Junior Developer`, `Intern`, or `QA`. This is a secondary attribute on top of the base role, used for:
- Display in the Users & Roles table and on ticket "Assignee" tooltips (internal views only).
- **Lead** and **Manager** sub-roles inherit **Director-level dashboard visibility**, scoped to the team(s) they're assigned to lead (not portfolio-wide unless they're also a Director/PM at the base-role level).
- Filtering in the work-hours and workload views (Section 9), e.g. "show me Junior Developer + Intern hours only."

### 3.3 Permission matrix

The existing in-app **Role & Permission Matrix** modal (Shield icon, visible to full-access roles) must be extended with three new capability rows:
- Add/edit/remove SLA policies (Admin only)
- Configure AI integrations (Admin only)
- View team-wide work-hours report (Admin, Director, PM, Lead — team-scoped for Lead)

---

## 4. Ticketing

### 4.1 Ticket types (Jira-style)

Expand ticket types to explicitly support a story-driven workflow:

`Story`, `Epic`, `Bug`, `Feature`, `Enhancement`, `Task`, `Change Request`, `Support`

**Where Stories get created:** today, "Story" is just one option in the same "New ticket" modal every role uses. That's fine for quick capture, but it's not how a delivery team actually plans work. Add a dedicated **Backlog** view (new nav item, visible to PM/Lead/Senior Dev/Junior Dev/QA/Admin/Director):
- List of all Story/Epic-type tickets for the current project, groupable by Epic.
- "New Story" and "New Epic" quick-create buttons pinned to the top (pre-fills Type, skips fields irrelevant to planning like Source/Channel).
- Drag to reorder backlog priority (separate from ticket Priority field — this is sequencing, not severity).
- A story can be dragged into a Sprint/board the same way existing Kanban drag-and-drop works.

### 4.2 Role-specific custom fields

Different roles capture different information on the same ticket. Rather than one rigid form, the ticket detail/create form should render additional field groups conditionally:

| Field group | Visible to | Fields |
|---|---|---|
| **Developer fields** | Developer (any seniority), Lead, Manager | Branch/PR link, Story points, Technical notes (private — not visible to Client) |
| **QA fields** | QA | Test case ID / link, Environment tested (Staging/Prod/UAT), Pass/Fail result, Regression flag |
| **PM fields** | PM, Lead, Manager, Director, Admin | Sprint, Release version, Stakeholder sign-off status |

These render as an expandable "Additional details" section on the ticket, only showing the field group(s) relevant to the current user's role — a QA user sees QA fields pinned open and Developer fields collapsed (still viewable, just secondary).

### 4.3 Attachments & documents

- All roles can **download** any attachment on a ticket or any document in a project's folder (already implemented as a first-class action, not buried in a menu).
- Files uploaded through the app are real, downloadable browser blobs in the prototype; production must persist these to real object storage (S3-compatible) with signed URLs and virus scanning on upload.

### 4.4 Time tracking

- **Who can track time:** PM, Lead, Manager, Senior/Junior Developer, Intern, QA, Admin. Director cannot start/stop timers (view-only).
- Start/stop a timer from the ticket detail view; only one active timer per person per ticket. Multiple people can each run their own concurrent timer on the same ticket.
- Every entry captures: person, seniority/role label, start time, end time, computed duration.
- Total logged time displays on the ticket (for turnaround-time/TAT analysis) and as a column in the ticket list for roles with time-tracking or full visibility.
- **New requirement — running-timer indicator:** any ticket list/table row with an active timer must visibly flag it — a pulsing dot + "Timer running Xm" label in the Time Logged column (not just a static number), so nobody has to open the ticket to know work is actively in progress on it.

### 4.5 Reopen workflow

- Client (and full-access roles) can reopen a Completed/Closed ticket. Status becomes **Reopened**, which counts as "open" everywhere (KPIs, ageing, SLA), triggers a notification to the assignee/watchers, and is logged in ticket history.

---

## 5. Developer Experience — "My Tasks" default view

- **Default landing for Developer/QA (any seniority):** a "My Tasks" filtered ticket view — only tickets currently assigned to them — so they land focused on their own queue, not the entire team's noise.
- A clearly visible toggle/tab ("My Tasks" ↔ "All Tickets") lets them step out to full visibility whenever needed; this is a view filter, not a permission change, since these roles already have full ticket visibility.
- Sort default: due date ascending, with overdue items pinned to the top regardless of sort.

---

## 6. Kanban Board

- Existing drag-and-drop between status columns is retained.
- Cards show priority-color left border, assignee avatar, label chip, and (new) a small timer icon badge when a timer is actively running on that card.
- Board access: PM, Lead, Manager, Developer (any seniority), QA, Admin, Director, Customer Success. Call Center, Operations, and Client do not get board access (ticket-list view is sufficient for their workflow).

---

## 7. Projects

- Create project (name, code, client, PM, start/end, priority, status, description).
- **Document folder** per project (BRD, data files, decks, etc.) — upload and **download**, for future reference, visible to anyone with project access.
- Project hub view: stats (total/open/overdue tickets), description, document folder, recent tickets list.

---

## 8. Dashboards & Analytics

### 8.1 Executive dashboard (Admin, Director, PM, Lead — team-scoped for Lead)
- KPI row: open tickets, due today, overdue, high+critical, closed this month, avg resolution time, **SLA compliance**, team capacity used.
- Open tickets by priority (donut).
- Recurring issue categories (label breakdown bar chart) — surfaces things like "Coupon Issue" spiking, so the org can fix root causes.
- **Trend summary** — Month / Quarter / Year toggle, created-vs-closed bars, SLA and resolution-time deltas vs. the prior period. Scoped to the selected project or merged across all projects.
- Ticket ageing heatmap by project.
- Sprint burndown, team workload (remaining hours by person), project health (red/amber/green by overdue ratio), upcoming milestones, recent activity feed.

### 8.2 Admin analytics (Admin only)
- Everything in 8.1, plus:
- **Project-wise performance table:** per project — total tickets, open, closed, average age of open tickets, and the client-raised subset (total/open/closed) — so leadership can see, under each project, how much of the load is client-driven vs. internal.
- Client-raised tickets rollup across all projects merged.

### 8.3 Field-team personal dashboard ("My tickets summary")
- Call Center, Customer Success, Operations each land on a personal summary: tickets they've raised — raised / open-pending / in-progress / closed — plus their own recurring-issue-category breakdown. Counts are scoped to the individual (by their logged-in identity), not the whole team.

### 8.4 Client summary
- Small, three-number summary at the top of the Client's ticket view: raised, open, closed (plus reopened count). No assignee names, no internal workload detail.

### 8.5 Work-hours visibility (new)

**Audience:** Admin, Director, PM, Lead (team-scoped).

A new **Team Hours** panel/tab showing, for the current day (with a date-range picker for history):
- Each team member (Developer/QA/PM, any seniority), hours logged today, and a lightweight bar comparing them to a configurable target (e.g., 6–8h/day).
- **Click-through:** clicking a person's row expands (or opens a drawer) listing exactly which tickets they logged time against that day, with per-ticket duration — so a manager can go from "who worked how much" to "on what" in one click, without digging through individual ticket histories.
- Filterable by seniority sub-role (e.g., "show only Junior Developers + Interns") and by project.
- This is built directly on the time-entry data already captured in Section 4.4 — no separate timesheet system needed.

---

## 9. SLA Management (new)

Today the dashboard shows an "SLA compliance %" trend, but there's no source of truth for what the SLA targets actually are. This closes that gap.

**Audience:** Admin only (add/edit/remove). Everyone with dashboard access can view the active policy.

**New "SLA Policies" admin screen:**
- Define SLA rules by **Priority** (Critical/High/Medium/Low) and optionally by **Project** or **Client**: first-response time target, resolution-time target.
- **Bulk upload via CSV/XLSX** for orgs migrating from an existing SLA spreadsheet (columns: priority, project, client, response target, resolution target), with a validation/preview step before committing.
- Manual add/edit/remove for one-off rules.
- Once configured, the existing "SLA compliance %" KPI and trend panel calculate against these real targets instead of a flat assumption, and tickets breaching SLA are flagged (badge on the ticket, and optionally an AI-driven early-warning — see Section 13.3).
- Audit trail of who changed which SLA rule and when (feeds the existing Comms & Tracking log).

---

## 10. Notifications & Communication

- Every ticket assignment, mention, status change, attachment, reopen, and new-project event triggers a simulated **Email + Microsoft Teams** notification (bell dropdown + full Comms & Tracking audit log for full-access roles).
- **Connected intake channels** panel documents how Call Center, Customer Success, Operations, Client Portal, Sales, and Teams plug into ticket creation via API/webhook, each tagging the ticket's `source` field automatically.
- Production requirement: real delivery needs an email provider (SES/SendGrid/Postmark) and the Microsoft Teams incoming-webhook or Graph API — the current build only renders accurate previews of what would be sent.

---

## 11. User & Access Management (Admin)

- Add/remove users, assign base role + seniority sub-role.
- Add/edit/remove **issue labels** (categories like "Login Issue," "Coupon Issue," etc.) used at ticket creation and rolled up in recurring-issue reporting. Removing a label doesn't retroactively change historical tickets.
- Add/edit/remove **SLA policies** (Section 9).
- Configure **AI integrations** (Section 13).
- In short: **Admin is the single place where anything gets added or removed at the org level** — users, roles, labels, SLA rules, AI providers.

---

## 12. Reporting Cadence

- Month-on-month, quarter-on-quarter, and year-on-year views share one **Trend Summary** component with a period toggle, so leadership isn't stuck picking one cadence — available on the main dashboard (merged across all projects) and scoped to a single project via the existing project filter.

---

## 13. AI Integrations — "Bring Your Own AI"

### 13.1 Concept

Rather than locking the org into one AI vendor, Admin can connect **any** compatible AI provider (OpenAI, Anthropic, Azure OpenAI, an internal/self-hosted model, etc.) by entering an API key and base endpoint. Once connected, that AI powers a set of automation features across the product — the org chooses which features are switched on.

### 13.2 Admin configuration screen

- Add one or more AI providers: name, provider type, API key (stored encrypted, never shown again after entry), base URL/model identifier, default model.
- Set a **default provider** and, optionally, override per feature (e.g., use a cheaper/faster model for auto-categorization, a stronger model for summarization).
- Usage dashboard: calls made, estimated token/cost usage per feature, per day — so Admin can see and control spend.
- Kill switch: disable any individual AI feature or the whole integration instantly.

### 13.3 Feature areas this powers (phased)

| Feature | What it reduces |
|---|---|
| **Auto-categorization** | Suggests the issue label/category as a ticket is raised (especially valuable for Call Center agents raising tickets fast) |
| **Auto-summarization** | Condenses a long comment thread/description into a 2–3 line summary shown at the top of the ticket |
| **Smart reply drafts** | Suggests a first-draft comment/response for the assignee to review and send, based on ticket history |
| **SLA breach prediction** | Flags tickets likely to breach SLA before they actually do, based on age, priority, and historical resolution patterns |
| **Duplicate/similar ticket detection** | Warns a reporter if a very similar open ticket already exists, before they create a duplicate |
| **Root-cause clustering** | Groups recurring issues beyond simple label counts — e.g., spotting that "Coupon Issue" tickets cluster around a specific release date |

### 13.4 Guardrails

- AI suggestions are always **advisory** — a human confirms before anything is sent, closed, or reassigned automatically, at least in this phase.
- All AI-assisted actions are logged in the Comms & Tracking audit trail with an "AI-assisted" tag, so there's a clear record of where automation touched a ticket.

---

## 14. Non-Functional Requirements (for a real build)

The current artifact is a front-end-only, in-browser prototype with mocked data — it demonstrates the intended UX and permission model but has no backend, no persistence, and no real authentication. A production build needs:

- Real authentication (SSO/OAuth) replacing the in-app "role switcher" demo convenience.
- A database for tickets, projects, users, time entries, labels, SLA policies, attachments metadata.
- Object storage (S3-compatible) for attachment/document files with signed download URLs.
- Server-side enforcement of every permission described above (today it's UI-only).
- Email provider + Microsoft Teams webhook/Graph API integration for real notification delivery.
- Secrets management for AI provider API keys (Section 13).
- Audit logging at the data layer, not just in the UI.

---

## 15. Open Questions

1. Should **Lead**/**Manager** seniority give visibility across multiple teams, or exactly one team each? (Assumed: one or more explicitly assigned teams.)
2. Should SLA policies support per-client overrides in addition to per-project? (Assumed yes, per Section 9 — confirm.)
3. For "bring your own AI," is a single org-wide provider sufficient for v1, or is per-project AI configuration needed later?
4. Should Interns have a hard cap on which ticket types they can close without a Senior/Lead sign-off?

---

## 16. Suggested Delivery Phases

| Phase | Scope |
|---|---|
| **Phase 1** | Rename + backend foundation: auth, database, real file storage, permission enforcement server-side. |
| **Phase 2** | Backlog/Stories view, role-specific custom fields, "My Tasks" default view, running-timer indicator. |
| **Phase 3** | Work-hours visibility, SLA policy management + upload, seniority sub-roles and Lead/Manager scoped dashboards. |
| **Phase 4** | AI integrations (bring-your-own-AI), starting with auto-categorization and SLA breach prediction. |
| **Phase 5** | Real email/Teams delivery, mobile-responsive polish, reporting exports (Excel/PDF/CSV). |
