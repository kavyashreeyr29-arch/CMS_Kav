import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface NotifyInput {
  recipientUserId: string;
  ticketId?: string;
  type: NotificationType;
  subject: string;
  body: string;
  channels?: NotificationChannel[];
}

/**
 * Persists the notification record and (eventually) enqueues real delivery.
 * LLD §1 / §6.1 / §10: production wiring is SQS/RabbitMQ/Redis Streams ->
 * a Notification Service -> SES/SendGrid + Microsoft Teams webhook/Graph
 * API. This scaffold persists synchronously and stops short of the actual
 * external send — swap `deliver()` for a queue publish once Phase 5 lands.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        ticketId: input.ticketId,
        type: input.type,
        subject: input.subject,
        body: input.body,
        channels: input.channels ?? [NotificationChannel.email, NotificationChannel.teams],
      },
    });
    await this.deliver(notification.id);
    return notification;
  }

  findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientUserId: userId, read: false },
      data: { read: true },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async deliver(_notificationId: string): Promise<void> {
    // TODO(Phase 5): publish to the notification queue for real email/Teams
    // delivery instead of a no-op. See docs/lld.md §6.1 and §9.
    return;
  }
}
