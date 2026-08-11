import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';

interface RecordInput {
  ticketId?: string;
  projectCode?: string;
  actorUserId: string;
  actionType: string;
  actionText: string;
  aiAssisted?: boolean;
}

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Every existing caller passes ticketId but not projectCode (verified —
  // none of the ~15 call sites across tickets/github/approvals set it), which
  // silently broke Dashboard.tsx's per-project "Recent activity" filter
  // (activity.filter(a => a.projectCode === projectFilter) always matched
  // nothing). Deriving it here once, from ticketId, fixes every call site
  // without threading `.project.code` through each of them individually.
  async record(input: RecordInput) {
    let projectCode = input.projectCode;
    if (!projectCode && input.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: input.ticketId }, select: { project: { select: { code: true } } } });
      projectCode = ticket?.project.code;
    }
    return this.prisma.activityLogEntry.create({
      data: {
        ticketId: input.ticketId,
        projectCode,
        actorUserId: input.actorUserId,
        actionType: input.actionType,
        actionText: input.actionText,
        aiAssisted: input.aiAssisted ?? false,
      },
    });
  }

  forTicket(ticketId: string) {
    return this.prisma.activityLogEntry.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: SAFE_USER_SELECT } },
    });
  }

  recent(limit = 20) {
    return this.prisma.activityLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: SAFE_USER_SELECT } },
    });
  }
}
