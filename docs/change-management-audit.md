# Change-management audit & roadmap

Audit of ElevatoHub's software-delivery change-management capabilities, the gaps found, what
was implemented in response, and a researched backlog of further automation/AI improvements.

_Last updated: 2026-07-30 (branch `feature/workflow-github-boards`)._

## 1. What existed before this pass

| Area | State |
|---|---|
| Ticket types | Epic, Story, Task, Bug, Feature, Enhancement, ChangeRequest, Support (`TicketType`) |
| Statuses | Open → Assigned → InProgress → InReview → QATesting → Completed → Closed (+ Reopened) |
| Transitions | **Unconstrained** — any role with ticket access could jump to any status. Only source/reporter-scoped roles were coarsely capped to Open/InProgress/Closed. No admin control, no conditions. |
| Boards | **One** — a fixed 5-column status Kanban. Backlog was a separate roadmap view. No grouping/swimlanes. |
| GitHub / VCS | **None.** Status was 100% manual. No branches/PRs/commits/approvals linked to tickets. |
| Dev traceability | None — no way to see "what code implements this ticket" or "is it merged". |

## 2. Gaps identified

1. **No process enforcement.** Nothing stopped a ticket from skipping QA or going straight to Completed. "Definition of done" lived only in people's heads.
2. **No admin-configurable workflow.** The (minimal) rules were hardcoded in `TicketsService`; changing them needed a code change + deploy.
3. **Manual status churn.** Developers updated ticket status by hand after every PR event — duplicated effort, always stale.
4. **No development visibility.** PMs couldn't see, from a ticket, whether a branch existed, whether the PR was approved, or whether it merged.
5. **Single board dimension.** "Who is overloaded?", "what's the priority mix?", "how is this epic progressing?" all required leaving the board for Analytics.

## 3. Implemented in this pass

### 3.1 Admin-configurable workflow with stage gates
- `WorkflowTransition` model (org-level): each row is one allowed `fromStatus → toStatus`, plus opt-in **gates**: `requiresAssignee`, `requiresLinkedPr`, `requiresApprovedPr`, `requiresMergedPr`, `requiresQaPass`, and an optional `allowedRoleIds` restriction.
- Central `WorkflowService.evaluate()` is the single gate — used by **both** manual status changes and GitHub auto-transitions, so automation can never push a ticket through a gate a human couldn't.
- Seeded with a **permissive default** (sensible forward/back/close graph, gates off) so the product is usable out of the box; admins tighten it at **/workflow**. New `manageWorkflow` permission.
- The ticket status picker and board drop-targets are now workflow-aware — they only offer valid transitions, and a blocked move surfaces the gate reason instead of silently failing.

### 3.2 GitHub integration (kills manual status updates)
- `GithubIntegration` model (per-org): repo, AES-256-GCM-encrypted PAT (write-only), per-org webhook secret, and a status-map (`onPrOpened/Approved/Merged → status`).
- **HMAC-verified webhook receiver** (`X-Hub-Signature-256` over the raw body) for `pull_request` and `pull_request_review` events.
- **Auto-linking**: PRs attach to tickets by matching the displayId (e.g. `ATLAS-1001`) in the branch name, PR title, or body — the Jira/GitHub smart-commit convention.
- **Auto-transition**: on PR open/approve/merge the linked ticket moves per the status-map — always through the workflow gates.
- **Jira-style Development panel** on the ticket: linked PRs with state (open/merged/closed), review/approval state, branch, author, and a link out to GitHub.

### 3.3 Multi-dimension board
- The Kanban gained a **Group by** switcher: **Status** (classic draggable columns), **Assignee**, **Priority**, **Type**, **Epic** (swimlanes). One board now answers where work is, who's loaded, the priority mix, the work-type mix, and per-epic progress. Cards show a "N PRs linked" badge.

### 3.4 Tests
`workflow-gates.spec.ts`, `github-webhook.spec.ts`, `board-grouping.spec.ts` — gate config + enforcement, HMAC signature rejection, auto-link + auto-transition, review state, and all five board groupings. Three pre-existing tests were updated for the now-deterministic transition rules.

### 3.5 Pre-development approval pipeline (follow-up pass)
Gap: the workflow above only modeled *engineering* delivery (Open→Closed) — there was no way to represent a
ticket still waiting on commercial sign-off, requirement sign-off, or manager approval before it's even ready
for a developer to pick up, and no generic way to *request* an approval, *decide* it, and keep an audit trail
of who asked, who decided, and what changes were requested on rejection.

- **Four new `TicketStatus` values** — `RequirementGathering` → `CommercialApproval` → `RequirementApproval` →
  `ManagerApproval` → (existing) `Open` — modeled as statuses, not a separate concept, so ageing, Analytics,
  SLA breach detection, and the board's Status grouping all understand the intake pipeline for free, the
  same way they already understand every other status. They're new board columns automatically.
- **Generic `ApprovalRequest` entity** (not a fixed type per stage) — a free-text `label`
  ("Commercial Approval", "Requirement Approval", "Manager's Approval", or anything else an org needs), a
  designated approver (a specific person or a role), and a `decision`
  (`pending`/`approved`/`rejected`/`changes_requested`, mirroring the GitHub PR review states already in the
  app) with a `decisionComment` — the audit trail's answer to "what changes were requested". A ticket keeps
  its **full approval history**, not just current state.
- **New `requiresApproval` workflow gate**, wired into the same `WorkflowService.evaluate()` used for
  PRs/QA — the admin ties it to any transition (seeded by default on all three intake-pipeline hops) and it
  blocks that move until the ticket's *most recent* approval request is `approved`. A rejection or
  changes-requested decision re-blocks the gate until a fresh request is sent and approved.
- **Every request/decision logs to the ticket's Activity timeline** (who requested, who decided, when, and
  the comment) — the same persistent per-ticket audit trail every other ticket action already uses, rather
  than a second, separate audit system.
- **Only the designated approver can decide** — deliberately **no admin override**, unlike some of this
  app's other "author or admin" patterns: Admin is very often the person *requesting* approval (it's the
  default full-access account), so an override would let a requester rubber-stamp their own request and
  defeat the entire point of segregation of duties. Caught by a test that assumed the override existed.
- **Ticket type drives the entry point**: `Feature`/`ChangeRequest` tickets — the types that typically need
  commercial/requirement/manager sign-off — now start in `RequirementGathering` instead of `Open`. Every
  other type (Bug/Task/Story/Epic/Enhancement/Support) is unchanged, so this added zero risk to existing
  behavior or tests.
- Tests: `approval-pipeline.spec.ts` — governance-type intake status, blocked-without-approval, the full
  send→forbidden-for-non-approver→approve→transition-unblocked cycle, reject-requires-a-comment plus the
  "still blocked until a fresh approval" re-gate, and the UI panel/board-column coverage.

## 4. Researched backlog — further automation & AI (next passes)

Prioritised by effort-reduction per unit of build cost. None of these are built yet.

### Automation / integration
1. **Smart commits** — parse commit messages (`ATLAS-1001 #time 2h #done`) from `push` events to log time and move status, not just PRs.
2. **CI/CD status gates** — consume GitHub `check_suite`/`status` events; add a `requiresGreenCi` gate and show build/deploy state on the ticket.
3. **Slack / Teams two-way** — post ticket + PR events to a channel and allow status changes via slash command / message action.
4. **GitLab & Bitbucket parity** — same webhook abstraction behind a provider interface.
5. **Auto-create branch from ticket** — a "Create branch" button that opens a correctly-named branch via the REST token.
6. **Bidirectional PR comment sync** — mirror ticket comments ↔ PR comments.
7. **Sprint model + burndown** — iterations with capacity, a sprint board, and an auto-generated burndown.

### AI (advisory-first, matching the existing bring-your-own-AI model)
8. **Auto-triage** — classify incoming tickets (type/priority/label/business-category) and suggest an assignee from historical routing.
9. **Duplicate detection** — embed ticket text and flag likely duplicates at creation time.
10. **PR ↔ ticket acceptance-criteria check** — summarise a PR diff and flag when it doesn't cover the ticket's acceptance criteria.
11. **Stand-up / status digest** — a daily AI summary per project: what moved, what's blocked, what's at SLA risk.
12. **SLA-breach prediction** — predict at-risk tickets from age/priority/assignee-load and pre-empt breaches (the `sla_breach_prediction` AI feature flag already exists as a stub).
13. **Release-notes generation** — from the set of tickets/PRs merged since the last tag.
14. **Effort estimation** — suggest story points from similar historical tickets.

The GitHub provider abstraction, the workflow-gate engine, and the bring-your-own-AI config from earlier work are the foundations these build on.
