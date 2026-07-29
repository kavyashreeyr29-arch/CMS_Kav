import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { TimersGateway } from '../realtime/timers.gateway';
import { WorkflowService } from '../workflow/workflow.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { RolePermissions } from '../common/permissions/role-permissions';
import { serializeTicketForViewer, ticketVisibilityWhere } from '../common/permissions/ticket-scope';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddAttachmentDto } from './dto/add-attachment.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTestCaseDto, UpdateTestCaseDto } from './dto/test-case.dto';

// PRD Phase 2 §3.2 — title/description are only editable while a ticket is
// in one of these statuses; Reopened counts as a return-to-Open for editing
// purposes since re-opening often means the original description needs
// correcting before work resumes.
const EDITABLE_STATUSES: TicketStatus[] = [TicketStatus.Open, TicketStatus.Reopened];
const EDITABLE_FIELD_LABELS: Record<keyof UpdateTicketDto, string> = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  labelId: 'Label',
  dueDate: 'Due date',
  assigneeUserId: 'Assignee',
  businessCategory: 'Business category',
};

// docs/prd-phase2.md §2.4
const BUSINESS_CATEGORY_REQUIRED_ROLES = ['customersuccess', 'pm', 'senior_developer', 'junior_developer', 'intern'];

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.Open,
  TicketStatus.Assigned,
  TicketStatus.InProgress,
  TicketStatus.InReview,
  TicketStatus.QATesting,
  TicketStatus.Reopened,
];

const TICKET_INCLUDE = {
  project: true,
  label: true,
  campaign: { select: { id: true, name: true } },
  reward: { select: { id: true, name: true } },
  reporter: { select: SAFE_USER_SELECT },
  assignee: { select: SAFE_USER_SELECT },
  // parent + PR count power the board's Epic swimlanes and the "N PRs linked"
  // card badge without pulling every PR row on a 200-ticket list.
  parent: { select: { id: true, displayId: true, title: true } },
  _count: { select: { attachments: true, comments: true, pullRequests: true } },
} satisfies Prisma.TicketInclude;

/** Activity-log text only — the ticket-list/detail UI has its own formatter. */
function formatDurationMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return `${Math.round(minutes)}m`;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly activityLog: ActivityLogService,
    private readonly timersGateway: TimersGateway,
    private readonly workflow: WorkflowService,
  ) {}

  async findAll(user: AuthenticatedUser, perms: RolePermissions, query: QueryTicketsDto) {
    const types = query.type?.split(',').filter(Boolean);
    const where: Prisma.TicketWhereInput = {
      AND: [
        ticketVisibilityWhere(user, perms),
        query.project ? { project: { code: query.project.toUpperCase() } } : {},
        query.status ? { status: query.status as TicketStatus } : {},
        query.priority ? { priority: query.priority as never } : {},
        query.source ? { source: query.source as never } : {},
        query.label ? { labelId: query.label } : {},
        query.slaBreached === 'true' ? { slaBreached: true } : {},
        types?.length ? { type: { in: types as never[] } } : {},
        // PRD §5 — Developer/QA base roles default to "My Tasks"; explicit
        // view=all removes the filter, view=mine (or the default) applies it.
        query.view === 'mine' ? { assigneeUserId: user.id } : {},
      ],
    };

    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? Math.min(parseInt(query.pageSize, 10), 200) : 50;

    // Backlog view (prd.md §4.1) orders by backlog_rank — sequencing,
    // distinct from the ticket `priority` field — rather than due date.
    const isBacklogQuery = !!types?.length && types.every((t) => ['Story', 'Epic'].includes(t));
    const orderBy: Prisma.TicketOrderByWithRelationInput = isBacklogQuery
      ? { backlogRank: 'asc' }
      : { dueDate: 'asc' };

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: { ...TICKET_INCLUDE, timeEntries: { select: { durationMinutes: true, endedAt: true, startedAt: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map(({ timeEntries, ...t }) => {
        // e.durationMinutes is a Prisma Decimal, not a plain number — must
        // coerce explicitly, since `sum + decimal` would string-concatenate
        // instead of adding (decimal.js's valueOf() returns a string).
        const totalLoggedMinutes = timeEntries.reduce((sum, e) => sum + Number(e.durationMinutes ?? 0), 0);
        const hasRunningTimer = timeEntries.some((e) => e.endedAt === null);
        // "Start date" per the user's definition is when work actually
        // began (first timer start), not the manually-set planned
        // startDate field — falls back to that, then createdAt, when no
        // timer has ever run.
        const actualStartAt = timeEntries.length
          ? new Date(Math.min(...timeEntries.map((e) => e.startedAt.getTime())))
          : null;
        return serializeTicketForViewer({ ...t, totalLoggedMinutes, hasRunningTimer, actualStartAt }, perms);
      }),
      page,
      pageSize,
      total,
    };
  }

  async findOne(id: string, user: AuthenticatedUser, perms: RolePermissions) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { AND: [{ id }, ticketVisibilityWhere(user, perms)] },
      include: {
        ...TICKET_INCLUDE,
        customFields: true,
        comments: { include: { author: { select: SAFE_USER_SELECT } }, orderBy: { createdAt: 'asc' } },
        attachments: true,
        timeEntries: { include: { user: { select: SAFE_USER_SELECT } } },
        parent: { select: { id: true, displayId: true, title: true } },
        children: { select: { id: true, displayId: true, title: true, status: true }, orderBy: { displayId: 'asc' } },
        pullRequests: { orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found or not visible to your role');
    return serializeTicketForViewer(ticket, perms);
  }

  /** LLD §6.1 — merged comments + status changes + time entries, chronological. */
  async history(id: string, user: AuthenticatedUser, perms: RolePermissions) {
    await this.findOne(id, user, perms); // enforces visibility
    return this.activityLog.forTicket(id);
  }

  async create(user: AuthenticatedUser, perms: RolePermissions, dto: CreateTicketDto) {
    const project = await this.prisma.project.findUnique({ where: { code: dto.projectCode.toUpperCase() } });
    if (!project) throw new BadRequestException(`Unknown project code: ${dto.projectCode}`);

    // docs/prd-phase2.md §2.4 — Business Category is compulsory for CS, PM,
    // and Developer roles (the ones actually doing billable/trackable work
    // across verticals); optional for everyone else.
    if (BUSINESS_CATEGORY_REQUIRED_ROLES.includes(user.baseRoleId) && !dto.businessCategory) {
      throw new BadRequestException('Business category is required for your role');
    }

    const displayId = await this.nextDisplayId(project.id, project.code);

    // Field-team/Client roles raise tickets as themselves; full-access roles
    // may create on behalf of the org (LLD/PRD §4 reporter semantics).
    const reporterUserId = perms.scope === 'all' ? user.id : user.id;

    const ticket = await this.prisma.ticket.create({
      data: {
        displayId,
        projectId: project.id,
        parentTicketId: dto.parentTicketId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        status: TicketStatus.Open,
        source: dto.source,
        businessCategory: dto.businessCategory,
        labelId: dto.labelId,
        reporterUserId,
        assigneeUserId: dto.assigneeUserId,
        watcherUserIds: dto.watcherUserIds ?? [],
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        storyPoints: dto.storyPoints,
        estimatedHours: dto.estimatedHours,
        customFields: dto.customFields
          ? { create: dto.customFields.map((f) => ({ fieldGroup: f.fieldGroup as never, fieldKey: f.fieldKey, fieldValue: f.fieldValue })) }
          : undefined,
      },
      include: TICKET_INCLUDE,
    });

    await this.activityLog.record({
      ticketId: ticket.id,
      actorUserId: user.id,
      actionType: 'created',
      actionText: `created ${ticket.displayId} via ${ticket.source}`,
    });

    if (ticket.assigneeUserId) {
      await this.notifications.notify({
        recipientUserId: ticket.assigneeUserId,
        ticketId: ticket.id,
        type: NotificationType.assigned,
        subject: `[${ticket.displayId}] Assigned to you: ${ticket.title}`,
        body: `${ticket.reporter.name} assigned "${ticket.title}" (${ticket.priority} priority, ${ticket.type}), raised via ${ticket.source}, to you.`,
      });
    }
    await this.notifyMentions(ticket.id, ticket.description ?? '', 'ticket description', user.id);
    for (const watcherId of ticket.watcherUserIds) {
      await this.notifications.notify({
        recipientUserId: watcherId,
        ticketId: ticket.id,
        type: NotificationType.watching,
        subject: `[${ticket.displayId}] Added as watcher`,
        body: `You were added as a watcher on "${ticket.title}".`,
      });
    }

    return serializeTicketForViewer(ticket, perms);
  }

  async updateStatus(id: string, user: AuthenticatedUser, perms: RolePermissions, status: TicketStatus) {
    const ticket = await this.mustFindRaw(id, user, perms);
    if (ticket.status === status) return serializeTicketForViewer(ticket, perms);

    // Source/reporter-scoped roles keep their coarse hard limit (they never
    // touch the dev workflow) — the configurable gate matrix governs the
    // full-visibility delivery roles.
    if (perms.restrictedStatuses && !this.isAllowedRestrictedStatus(status)) {
      throw new ForbiddenException('Your role can only set status to Open, In Progress, or Closed');
    }

    // Admin-configurable workflow gates (WorkflowService) — replaces the old
    // "any transition allowed" behavior. Skipped for restricted-status roles,
    // whose narrow set is already enforced above and predates the workflow.
    if (!perms.restrictedStatuses) {
      const ctx = await this.workflow.gateContextFor(id, !!ticket.assigneeUserId);
      const reason = await this.workflow.evaluate(user.orgId, ticket.status, status, user.baseRoleId, ctx);
      if (reason) throw new BadRequestException(reason);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
        closedAt: status === TicketStatus.Closed ? new Date() : status === TicketStatus.Reopened ? null : undefined,
      },
      include: TICKET_INCLUDE,
    });

    await this.activityLog.record({
      ticketId: id,
      actorUserId: user.id,
      actionType: 'status_change',
      actionText: `moved ${ticket.displayId} from ${ticket.status} to ${status}`,
    });
    await this.recordFieldChange(id, user.id, 'Status', ticket.status, status);

    const recipients = [ticket.assigneeUserId, ...ticket.watcherUserIds].filter(
      (v, i, a): v is string => !!v && a.indexOf(v) === i,
    );
    for (const recipientUserId of recipients) {
      await this.notifications.notify({
        recipientUserId,
        ticketId: id,
        type: NotificationType.status,
        subject: `[${ticket.displayId}] Status changed to ${status}`,
        body: `${ticket.displayId} — "${ticket.title}" moved from ${ticket.status} to ${status}.`,
      });
    }

    return serializeTicketForViewer(updated, perms);
  }

  /**
   * PRD Phase 2 §3.2 — title/description/priority/label/due date/assignee
   * are only editable while a ticket is Open/Reopened, and only by its
   * reporter or a full-access (scope: 'all'/'team') role. Once work has
   * moved past Open, what the ticket *is* becomes a fixed record — further
   * changes belong in a comment, not a silent field edit.
   */
  async updateFields(id: string, user: AuthenticatedUser, perms: RolePermissions, dto: UpdateTicketDto) {
    const ticket = await this.mustFindRaw(id, user, perms);

    if (!EDITABLE_STATUSES.includes(ticket.status)) {
      throw new ForbiddenException('This ticket can only be edited while it is Open — add a comment for further changes instead');
    }
    const canEdit = ticket.reporterUserId === user.id || perms.scope === 'all' || perms.scope === 'team';
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this ticket');
    }

    const data: Prisma.TicketUncheckedUpdateInput = {};
    const changes: { fieldName: string; oldValue: unknown; newValue: unknown }[] = [];

    if (dto.title !== undefined && dto.title !== ticket.title) {
      changes.push({ fieldName: EDITABLE_FIELD_LABELS.title, oldValue: ticket.title, newValue: dto.title });
      data.title = dto.title;
    }
    if (dto.description !== undefined && dto.description !== (ticket.description ?? '')) {
      changes.push({ fieldName: EDITABLE_FIELD_LABELS.description, oldValue: ticket.description, newValue: dto.description });
      data.description = dto.description;
    }
    if (dto.priority !== undefined && dto.priority !== ticket.priority) {
      changes.push({ fieldName: EDITABLE_FIELD_LABELS.priority, oldValue: ticket.priority, newValue: dto.priority });
      data.priority = dto.priority;
    }
    if (dto.businessCategory !== undefined && dto.businessCategory !== ticket.businessCategory) {
      changes.push({ fieldName: EDITABLE_FIELD_LABELS.businessCategory, oldValue: ticket.businessCategory, newValue: dto.businessCategory });
      data.businessCategory = dto.businessCategory;
    }
    if (dto.labelId !== undefined) {
      const nextLabelId = dto.labelId || null;
      if (nextLabelId !== ticket.labelId) {
        changes.push({ fieldName: EDITABLE_FIELD_LABELS.labelId, oldValue: ticket.labelId, newValue: nextLabelId });
        data.labelId = nextLabelId;
      }
    }
    if (dto.dueDate !== undefined) {
      const nextDue = dto.dueDate ? new Date(dto.dueDate).toISOString().slice(0, 10) : null;
      const prevDue = ticket.dueDate ? ticket.dueDate.toISOString().slice(0, 10) : null;
      if (nextDue !== prevDue) {
        changes.push({ fieldName: EDITABLE_FIELD_LABELS.dueDate, oldValue: prevDue, newValue: nextDue });
        data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      }
    }
    if (dto.assigneeUserId !== undefined) {
      const nextAssignee = dto.assigneeUserId || null;
      if (nextAssignee !== ticket.assigneeUserId) {
        changes.push({ fieldName: EDITABLE_FIELD_LABELS.assigneeUserId, oldValue: ticket.assigneeUserId, newValue: nextAssignee });
        data.assigneeUserId = nextAssignee;
      }
    }

    if (changes.length === 0) return serializeTicketForViewer(ticket, perms);

    const updated = await this.prisma.ticket.update({ where: { id }, data, include: TICKET_INCLUDE });

    await Promise.all(changes.map((c) => this.recordFieldChange(id, user.id, c.fieldName, c.oldValue, c.newValue)));
    await this.activityLog.record({
      ticketId: id,
      actorUserId: user.id,
      actionType: 'edited',
      actionText: `updated ${changes.map((c) => c.fieldName).join(', ')} on ${ticket.displayId}`,
    });

    return serializeTicketForViewer(updated, perms);
  }

  // Deliberately separate from updateFields() — linking a ticket to a
  // project's Campaign/Reward folder isn't a content edit gated to
  // Open/Reopened tickets (a Closed ticket can still be tagged as part of a
  // past campaign for reporting purposes).
  async linkCampaign(id: string, user: AuthenticatedUser, perms: RolePermissions, campaignId: string | null) {
    const ticket = await this.mustFindRaw(id, user, perms);
    const updated = await this.prisma.ticket.update({ where: { id }, data: { campaignId }, include: TICKET_INCLUDE });
    await this.recordFieldChange(id, user.id, 'Campaign', ticket.campaignId, campaignId);
    return serializeTicketForViewer(updated, perms);
  }

  async linkReward(id: string, user: AuthenticatedUser, perms: RolePermissions, rewardId: string | null) {
    const ticket = await this.mustFindRaw(id, user, perms);
    const updated = await this.prisma.ticket.update({ where: { id }, data: { rewardId }, include: TICKET_INCLUDE });
    await this.recordFieldChange(id, user.id, 'Reward', ticket.rewardId, rewardId);
    return serializeTicketForViewer(updated, perms);
  }

  /** PRD Phase 2 §3.3 — the structured "who changed what" list for a ticket's detail view. */
  fieldChangeLog(id: string) {
    return this.prisma.ticketFieldChange.findMany({
      where: { ticketId: id },
      include: { changer: { select: SAFE_USER_SELECT } },
      orderBy: { changedAt: 'desc' },
    });
  }

  private recordFieldChange(ticketId: string, userId: string, fieldName: string, oldValue: unknown, newValue: unknown) {
    return this.prisma.ticketFieldChange.create({
      data: {
        ticketId,
        changedBy: userId,
        fieldName,
        oldValue: oldValue === null || oldValue === undefined || oldValue === '' ? null : String(oldValue),
        newValue: newValue === null || newValue === undefined || newValue === '' ? null : String(newValue),
      },
    });
  }

  /** PRD §4.5 — Client (and full-access roles) reopen a Completed/Closed ticket. */
  async reopen(id: string, user: AuthenticatedUser, perms: RolePermissions) {
    if (!perms.canReopen) throw new ForbiddenException('Your role cannot reopen tickets');

    const ticket = await this.mustFindRaw(id, user, perms);
    const reopenableStatuses: TicketStatus[] = [TicketStatus.Completed, TicketStatus.Closed];
    if (!reopenableStatuses.includes(ticket.status)) {
      throw new BadRequestException('Only Completed or Closed tickets can be reopened');
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.Reopened, closedAt: null },
      include: TICKET_INCLUDE,
    });

    await this.activityLog.record({
      ticketId: id,
      actorUserId: user.id,
      actionType: 'reopened',
      actionText: `reopened ${ticket.displayId}`,
    });
    await this.recordFieldChange(id, user.id, 'Status', ticket.status, TicketStatus.Reopened);

    const recipients = [ticket.assigneeUserId, ...ticket.watcherUserIds].filter(
      (v, i, a): v is string => !!v && a.indexOf(v) === i,
    );
    for (const recipientUserId of recipients) {
      await this.notifications.notify({
        recipientUserId,
        ticketId: id,
        type: NotificationType.reopened,
        subject: `[${ticket.displayId}] Reopened`,
        body: `${ticket.displayId} — "${ticket.title}" was reopened. It was previously marked ${ticket.status}.`,
      });
    }

    return serializeTicketForViewer(updated, perms);
  }

  async addComment(id: string, user: AuthenticatedUser, perms: RolePermissions, dto: AddCommentDto) {
    const ticket = await this.mustFindRaw(id, user, perms);
    const mentioned = extractMentions(dto.body);

    const comment = await this.prisma.ticketComment.create({
      data: { ticketId: id, authorUserId: user.id, body: dto.body, mentionedUserIds: mentioned },
      include: { author: { select: SAFE_USER_SELECT } },
    });

    await this.activityLog.record({
      ticketId: id,
      actorUserId: user.id,
      actionType: 'commented',
      actionText: `commented on ${ticket.displayId}`,
    });
    await this.notifyMentions(id, dto.body, 'comment', user.id);

    return comment;
  }

  /** prd.md §10 — watchers get notified on status changes/comments (see notifyMentions/updateStatus). */
  async addWatcher(id: string, user: AuthenticatedUser, perms: RolePermissions, watcherUserId: string) {
    const ticket = await this.mustFindRaw(id, user, perms);
    if (ticket.watcherUserIds.includes(watcherUserId)) return serializeTicketForViewer(ticket, perms);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { watcherUserIds: { push: watcherUserId } },
      include: TICKET_INCLUDE,
    });

    await this.activityLog.record({
      ticketId: id,
      actorUserId: user.id,
      actionType: 'watcher_added',
      actionText: `added a watcher to ${ticket.displayId}`,
    });
    await this.notifications.notify({
      recipientUserId: watcherUserId,
      ticketId: id,
      type: NotificationType.watching,
      subject: `[${ticket.displayId}] Added as watcher`,
      body: `You were added as a watcher on "${ticket.title}". You'll get updates on status changes and comments.`,
    });

    return serializeTicketForViewer(updated, perms);
  }

  requestAttachmentUploadUrl(ticketId: string, fileName: string) {
    const key = this.storage.buildStorageKey('tickets', ticketId, fileName);
    return this.storage.getUploadUrl(key).then((res) => ({ ...res, storageKey: key }));
  }

  /** docs/prd-phase2.md §12 — QA testing module. */
  testCases(id: string) {
    return this.prisma.ticketTestCase.findMany({
      where: { ticketId: id },
      include: {
        creator: { select: SAFE_USER_SELECT },
        executor: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addTestCase(id: string, user: AuthenticatedUser, perms: RolePermissions, dto: CreateTestCaseDto) {
    const ticket = await this.mustFindRaw(id, user, perms);
    const testCase = await this.prisma.ticketTestCase.create({
      data: {
        ticketId: id,
        title: dto.title,
        steps: dto.steps,
        expectedResult: dto.expectedResult,
        createdBy: user.id,
      },
      include: { creator: { select: SAFE_USER_SELECT }, executor: { select: SAFE_USER_SELECT } },
    });
    await this.activityLog.record({
      ticketId: id, actorUserId: user.id, actionType: 'test_case_added',
      actionText: `added test case "${dto.title}" to ${ticket.displayId}`,
    });
    return testCase;
  }

  async updateTestCase(id: string, testCaseId: string, user: AuthenticatedUser, perms: RolePermissions, dto: UpdateTestCaseDto) {
    const ticket = await this.mustFindRaw(id, user, perms);
    const existing = await this.prisma.ticketTestCase.findFirst({ where: { id: testCaseId, ticketId: id } });
    if (!existing) throw new NotFoundException('Test case not found');

    const updated = await this.prisma.ticketTestCase.update({
      where: { id: testCaseId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status, executedBy: user.id, executedAt: new Date() } : {}),
        ...(dto.regressionFlag !== undefined ? { regressionFlag: dto.regressionFlag } : {}),
      },
      include: { creator: { select: SAFE_USER_SELECT }, executor: { select: SAFE_USER_SELECT } },
    });

    if (dto.status !== undefined) {
      await this.activityLog.record({
        ticketId: id, actorUserId: user.id, actionType: 'test_case_executed',
        actionText: `marked test case "${existing.title}" as ${dto.status} on ${ticket.displayId}`,
      });
    }
    return updated;
  }

  async removeTestCase(id: string, testCaseId: string, user: AuthenticatedUser, perms: RolePermissions) {
    await this.mustFindRaw(id, user, perms);
    await this.prisma.ticketTestCase.deleteMany({ where: { id: testCaseId, ticketId: id } });
  }

  async addAttachment(id: string, user: AuthenticatedUser, perms: RolePermissions, dto: AddAttachmentDto) {
    const ticket = await this.mustFindRaw(id, user, perms);

    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeKind: dto.mimeKind,
        storageKey: dto.storageKey,
        uploadedBy: user.id,
        context: dto.context,
      },
    });

    await this.activityLog.record({
      ticketId: id,
      actorUserId: user.id,
      actionType: 'attachment',
      actionText: `attached ${dto.fileName} to ${ticket.displayId}`,
    });

    const recipients = [ticket.assigneeUserId, ...ticket.watcherUserIds].filter(
      (v, i, a): v is string => !!v && a.indexOf(v) === i,
    );
    for (const recipientUserId of recipients) {
      await this.notifications.notify({
        recipientUserId,
        ticketId: id,
        type: NotificationType.attachment,
        subject: `[${ticket.displayId}] New attachment added`,
        body: `A file was added to "${ticket.title}".`,
      });
    }

    return attachment;
  }

  /** Signed, time-limited download URL — never a permanent public one (LLD §8). */
  async getAttachmentDownloadUrl(ticketId: string, attachmentId: string, user: AuthenticatedUser, perms: RolePermissions) {
    await this.mustFindRaw(ticketId, user, perms); // enforces visibility before revealing anything
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return this.storage.getDownloadUrl(attachment.storageKey);
  }

  // -- Time tracking (LLD §4.4, §6.2) -----------------------------------

  async startTimer(id: string, user: AuthenticatedUser, perms: RolePermissions) {
    if (!perms.timeTracking) throw new ForbiddenException('Your role cannot track time');
    const ticket = await this.mustFindRaw(id, user, perms);

    try {
      const entry = await this.prisma.timeEntry.create({
        data: { ticketId: id, userId: user.id, startedAt: new Date() },
      });
      this.timersGateway.broadcastTimerState(ticket.project.code, id, true);
      await this.activityLog.record({
        ticketId: id, actorUserId: user.id, actionType: 'timer_start',
        actionText: `started the timer on ${ticket.displayId}`,
      });
      return entry;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('You already have a running timer on this ticket');
      }
      throw err;
    }
  }

  async stopTimer(id: string, user: AuthenticatedUser, perms: RolePermissions) {
    const ticket = await this.mustFindRaw(id, user, perms);
    const running = await this.prisma.timeEntry.findFirst({
      where: { ticketId: id, userId: user.id, endedAt: null },
    });
    if (!running) throw new BadRequestException('No running timer for you on this ticket');

    const endedAt = new Date();
    // Fractional minutes, 2dp — a timer stopped after a handful of seconds
    // must not round down to 0 (see CHANGELOG.md phase-2 timer precision fix).
    const durationMinutes = Math.round(((endedAt.getTime() - running.startedAt.getTime()) / 60000) * 100) / 100;

    const updated = await this.prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt, durationMinutes },
    });

    const stillRunning = await this.prisma.timeEntry.count({ where: { ticketId: id, endedAt: null } });
    this.timersGateway.broadcastTimerState(ticket.project.code, id, stillRunning > 0);

    await this.activityLog.record({
      ticketId: id, actorUserId: user.id, actionType: 'timer_stop',
      actionText: `stopped the timer on ${ticket.displayId} — logged ${formatDurationMinutes(durationMinutes)}`,
    });

    return updated;
  }

  /** PRD §4.1 — drag-to-reorder backlog priority (sequencing, not severity). */
  async updateBacklogRank(id: string, user: AuthenticatedUser, perms: RolePermissions, backlogRank: number) {
    await this.mustFindRaw(id, user, perms);
    return this.prisma.ticket.update({ where: { id }, data: { backlogRank }, include: TICKET_INCLUDE });
  }

  // -- internals -----------------------------------------------------------

  private async mustFindRaw(id: string, user: AuthenticatedUser, perms: RolePermissions) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { AND: [{ id }, ticketVisibilityWhere(user, perms)] },
      include: TICKET_INCLUDE,
    });
    if (!ticket) throw new NotFoundException('Ticket not found or not visible to your role');
    return ticket;
  }

  private isAllowedRestrictedStatus(status: TicketStatus): boolean {
    const allowed: TicketStatus[] = [TicketStatus.Open, TicketStatus.InProgress, TicketStatus.Closed];
    return allowed.includes(status);
  }

  private async notifyMentions(ticketId: string, text: string, source: string, actorId: string) {
    const mentioned = extractMentions(text);
    if (!mentioned.length) return;
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return;
    for (const userId of mentioned) {
      if (userId === actorId) continue;
      await this.notifications.notify({
        recipientUserId: userId,
        ticketId,
        type: NotificationType.mentioned,
        subject: `[${ticket.displayId}] You were mentioned`,
        body: `Someone mentioned you in a ${source} on "${ticket.title}".`,
      });
    }
  }

  /** Atomic per-project counter avoids a race-prone COUNT(*) (LLD §2.2 display_id). */
  private async nextDisplayId(projectId: string, projectCode: string): Promise<string> {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { ticketSeq: { increment: 1 } },
    });
    return `${projectCode}-${project.ticketSeq}`;
  }
}

/**
 * Mirrors the prototype's @[...] mention syntax (docs/prototype/pulse-dashboard.jsx),
 * adapted to carry a user id instead of a display name so the recipient can be
 * notified directly — the frontend's mention picker inserts `@[userId]` while
 * rendering the person's name to the user.
 */
function extractMentions(text: string): string[] {
  const re = /@\[([^\]]+)\]/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ''))) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}
