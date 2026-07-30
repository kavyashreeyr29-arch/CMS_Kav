import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalDecision, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { CreateApprovalRequestDto, DecideApprovalDto } from './dto/create-approval-request.dto';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

const APPROVAL_INCLUDE = {
  requestedBy: { select: SAFE_USER_SELECT },
  approver: { select: SAFE_USER_SELECT },
  decidedBy: { select: SAFE_USER_SELECT },
} as const;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  listForTicket(ticketId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { ticketId },
      include: APPROVAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateApprovalRequestDto) {
    if (!dto.approverUserId && !dto.approverRoleId) {
      throw new BadRequestException('Choose either a specific approver or an approver role');
    }
    const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (dto.approverUserId) {
      const approver = await this.prisma.user.findUnique({ where: { id: dto.approverUserId } });
      if (!approver) throw new BadRequestException('Approver not found');
    }

    const request = await this.prisma.approvalRequest.create({
      data: {
        ticketId: dto.ticketId,
        label: dto.label,
        requestedByUserId: user.id,
        approverUserId: dto.approverUserId,
        approverRoleId: dto.approverRoleId,
        requestNote: dto.requestNote,
      },
      include: APPROVAL_INCLUDE,
    });

    await this.activityLog.record({
      ticketId: ticket.id,
      actorUserId: user.id,
      actionType: 'approval_requested',
      actionText: `sent ${ticket.displayId} for "${dto.label}"${request.approver ? ` to ${request.approver.name}` : dto.approverRoleId ? ` to any ${dto.approverRoleId}` : ''}`,
    });

    if (dto.approverUserId) {
      await this.notifications.notify({
        recipientUserId: dto.approverUserId,
        ticketId: ticket.id,
        type: NotificationType.approval,
        subject: `[${ticket.displayId}] Approval requested: ${dto.label}`,
        body: `${request.requestedBy.name} sent "${ticket.title}" for ${dto.label}.${dto.requestNote ? ` Note: ${dto.requestNote}` : ''}`,
      });
    } else if (dto.approverRoleId) {
      const roleHolders = await this.prisma.user.findMany({ where: { baseRoleId: dto.approverRoleId, status: 'active' }, select: { id: true } });
      for (const holder of roleHolders) {
        await this.notifications.notify({
          recipientUserId: holder.id,
          ticketId: ticket.id,
          type: NotificationType.approval,
          subject: `[${ticket.displayId}] Approval requested: ${dto.label}`,
          body: `${request.requestedBy.name} sent "${ticket.title}" for ${dto.label} — any ${dto.approverRoleId} can decide.${dto.requestNote ? ` Note: ${dto.requestNote}` : ''}`,
        });
      }
    }

    return request;
  }

  async decide(id: string, user: AuthenticatedUser, dto: DecideApprovalDto) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: { ...APPROVAL_INCLUDE, ticket: { select: { id: true, displayId: true, title: true } } },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.decision !== ApprovalDecision.pending) {
      throw new BadRequestException('This approval request has already been decided');
    }
    if (!this.canDecide(request, user)) {
      throw new ForbiddenException('You are not the designated approver for this request');
    }
    if (dto.decision !== 'approved' && !dto.comment?.trim()) {
      throw new BadRequestException('A comment is required when rejecting or requesting changes');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        decision: dto.decision as ApprovalDecision,
        decisionComment: dto.comment,
        decidedByUserId: user.id,
        decidedAt: new Date(),
      },
      include: APPROVAL_INCLUDE,
    });

    const verb = dto.decision === 'approved' ? 'approved' : dto.decision === 'rejected' ? 'rejected' : 'requested changes on';
    await this.activityLog.record({
      ticketId: request.ticket.id,
      actorUserId: user.id,
      actionType: 'approval_decided',
      actionText: `${verb} "${request.label}" on ${request.ticket.displayId}${dto.comment ? ` — ${dto.comment}` : ''}`,
    });

    await this.notifications.notify({
      recipientUserId: request.requestedByUserId,
      ticketId: request.ticket.id,
      type: NotificationType.approval,
      subject: `[${request.ticket.displayId}] ${request.label}: ${dto.decision === 'approved' ? 'Approved' : dto.decision === 'rejected' ? 'Rejected' : 'Changes requested'}`,
      body: `${updated.decidedBy?.name} ${verb} "${request.label}" on "${request.ticket.title}".${dto.comment ? ` ${dto.comment}` : ''}`,
    });

    return updated;
  }

  // Deliberately NO admin override here (unlike e.g. ProjectNotesService's
  // "author or admin" delete) — an approval gate's entire point is
  // segregation of duties, and Admin is very often the person *requesting*
  // approval in this app (it's the default full-access account), so an
  // override would let a requester rubber-stamp their own request.
  private canDecide(request: { approverUserId: string | null; approverRoleId: string | null }, user: AuthenticatedUser): boolean {
    if (request.approverUserId) return request.approverUserId === user.id;
    if (request.approverRoleId) return request.approverRoleId === user.baseRoleId;
    return false;
  }
}
