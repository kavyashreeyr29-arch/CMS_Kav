export type TicketType = 'Story' | 'Epic' | 'Bug' | 'Feature' | 'Enhancement' | 'Task' | 'ChangeRequest' | 'Support';
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
// RequirementGathering/CommercialApproval/RequirementApproval/ManagerApproval
// are the pre-development intake/approval pipeline (CHANGELOG.md) — a ticket
// sits here before it's ready for engineering work at all.
export type TicketStatus =
  | 'RequirementGathering' | 'CommercialApproval' | 'RequirementApproval' | 'ManagerApproval'
  | 'Open' | 'Assigned' | 'InProgress' | 'InReview' | 'QATesting' | 'Completed' | 'Closed' | 'Reopened';
// EmailInbound added alongside the email-to-ticket intake feature
// (CHANGELOG.md) — was missing from this union even after that backend
// enum value shipped, since nothing in the frontend narrows against it by
// literal; fixed while touching this file for the BusinessCategory change.
export type TicketSource = 'InternalPM' | 'CallCenter' | 'CustomerSuccess' | 'Operations' | 'ClientPortal' | 'Sales' | 'EmailInbound';
// Was a fixed 3-value union — now an admin-manageable list
// (CHANGELOG.md), so any string the admin has configured is valid.
export type MimeKind = 'image' | 'video' | 'doc' | 'audio';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarInitials: string | null;
  baseRoleId?: string;
}

export interface LabelSummary {
  id: string;
  name: string;
}

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  client: string;
}

export interface TimeEntry {
  id: string;
  ticketId: string;
  userId: string;
  user?: UserSummary;
  startedAt: string;
  endedAt: string | null;
  // Prisma Decimal fields serialize as a numeric string over JSON, not a
  // number — see components/ui/formatDuration.ts, which handles both.
  durationMinutes: string | number | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorUserId: string;
  author?: UserSummary;
  body: string;
  mentionedUserIds: string[];
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  fileName: string;
  fileSize: number;
  mimeKind: MimeKind;
  storageKey: string;
  context?: string | null;
  createdAt: string;
}

export interface TicketRef {
  id: string;
  displayId: string;
  title: string;
  status?: TicketStatus;
}

export type TestCaseStatus = 'pending' | 'pass' | 'fail' | 'blocked';

export interface TestCase {
  id: string;
  ticketId: string;
  title: string;
  steps: string | null;
  expectedResult: string | null;
  status: TestCaseStatus;
  regressionFlag: boolean;
  executedBy: string | null;
  executor?: UserSummary | null;
  executedAt: string | null;
  createdBy: string;
  creator?: UserSummary;
  createdAt: string;
}

export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface ApprovalRequest {
  id: string;
  ticketId: string;
  label: string;
  requestedByUserId: string;
  requestedBy: UserSummary;
  approverUserId: string | null;
  approver: UserSummary | null;
  approverRoleId: string | null;
  decision: ApprovalDecision;
  requestNote: string | null;
  decisionComment: string | null;
  decidedByUserId: string | null;
  decidedBy: UserSummary | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface MyApprovalRequest extends ApprovalRequest {
  ticket: { id: string; displayId: string; title: string; status: TicketStatus; project: { code: string; name: string } };
}

export type PrState = 'open' | 'closed' | 'merged';
export type PrReviewState = 'pending' | 'approved' | 'changes_requested';

export interface PullRequestLink {
  id: string;
  ticketId: string;
  number: number;
  title: string;
  url: string;
  headRef: string;
  authorLogin: string;
  state: PrState;
  reviewState: PrReviewState;
  merged: boolean;
  linkedManually: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  displayId: string;
  projectId: string;
  project?: ProjectSummary;
  parentTicketId: string | null;
  parent?: TicketRef | null;
  children?: TicketRef[];
  title: string;
  description: string | null;
  type: TicketType;
  priority: Priority;
  status: TicketStatus;
  source: TicketSource;
  businessCategory: string | null;
  labelId: string | null;
  label?: LabelSummary | null;
  reporterUserId: string;
  reporter?: UserSummary;
  // Server-redacted view (backend/src/common/permissions/ticket-scope.ts) —
  // never trust a raw assigneeUserId for reporter-scoped viewers, it will
  // simply be null.
  assigneeId: string | null;
  assigneeDisplay: string | null;
  watcherUserIds: string[];
  startDate: string | null;
  dueDate: string | null;
  storyPoints: number | null;
  estimatedHours: number | null;
  slaBreached: boolean;
  slaBreachRisk: 'low' | 'medium' | 'high' | null;
  createdAt: string;
  updatedAt: string;
  // Set when status transitions to Closed, cleared on reopen — the real
  // "closed on" date, distinct from updatedAt (which changes on any edit).
  closedAt: string | null;
  // List endpoint computes this from the earliest time-entry start; detail
  // endpoint doesn't need it since the full timeEntries array is present —
  // compute it client-side there instead (see ticketActualStart() helper).
  actualStartAt?: string | null;
  campaignId: string | null;
  campaign?: { id: string; name: string } | null;
  rewardId: string | null;
  reward?: { id: string; name: string } | null;
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
  timeEntries?: TimeEntry[];
  pullRequests?: PullRequestLink[];
  totalLoggedMinutes?: number;
  hasRunningTimer?: boolean;
  _count?: { attachments: number; comments: number; pullRequests?: number; approvalRequests?: number };
}

export interface FieldChange {
  id: string;
  ticketId: string;
  changedBy: string;
  changer?: UserSummary;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export interface ActivityEntry {
  id: string;
  ticketId: string | null;
  projectCode: string | null;
  actorUserId: string;
  actor?: UserSummary;
  actionType: string;
  actionText: string;
  aiAssisted: boolean;
  createdAt: string;
}

export interface PaginatedTickets {
  data: Ticket[];
  page: number;
  pageSize: number;
  total: number;
}
