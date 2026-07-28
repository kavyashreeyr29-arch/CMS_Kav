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

  record(input: RecordInput) {
    return this.prisma.activityLogEntry.create({
      data: {
        ticketId: input.ticketId,
        projectCode: input.projectCode,
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
