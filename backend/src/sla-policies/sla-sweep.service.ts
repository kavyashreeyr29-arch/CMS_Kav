import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SlaPoliciesService } from './sla-policies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, TicketStatus } from '@prisma/client';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.Open, TicketStatus.Assigned, TicketStatus.InProgress,
  TicketStatus.InReview, TicketStatus.QATesting, TicketStatus.Reopened,
];

/**
 * LLD §6.3 — scheduled SLA breach sweep. Every 5–10 minutes: fetch open
 * tickets, resolve the applicable policy per ticket, compute isBreached +
 * ruleBasedBreachRisk, persist onto the ticket row so dashboard reads stay
 * O(1), and notify on newly-breached tickets.
 *
 * The optional AI refinement step (predictBreachRisk) is wired through
 * AiAdapterService when an org has `sla_breach_prediction` enabled — see
 * src/ai/ai.service.ts.
 */
@Injectable()
export class SlaSweepService {
  private readonly logger = new Logger(SlaSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slaPolicies: SlaPoliciesService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep() {
    const openTickets = await this.prisma.ticket.findMany({
      where: { status: { in: OPEN_STATUSES } },
      // orgId isn't on Project/Ticket directly (LLD's ER model scopes org
      // only down to User/Label/SlaPolicy/AiProviderConfig) — reporter is
      // the cheapest join back to an org for policy resolution.
      include: { project: true, reporter: { select: { orgId: true } } },
    });

    let breachedCount = 0;
    for (const ticket of openTickets) {
      const policy = await this.slaPolicies.resolveSlaForTicket(ticket.reporter.orgId, ticket as never);
      const breached = this.slaPolicies.isBreached(ticket, policy);
      const risk = this.slaPolicies.ruleBasedBreachRisk(ticket, policy);

      const wasBreached = ticket.slaBreached;
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          slaBreached: breached,
          slaBreachAt: breached && !wasBreached ? new Date() : ticket.slaBreachAt,
          slaBreachRisk: risk,
        },
      });

      if (breached) breachedCount += 1;

      if (breached && !wasBreached && ticket.assigneeUserId) {
        await this.notifications.notify({
          recipientUserId: ticket.assigneeUserId,
          ticketId: ticket.id,
          type: NotificationType.status,
          subject: `[${ticket.displayId}] SLA breached`,
          body: `${ticket.displayId} — "${ticket.title}" has breached its SLA resolution target.`,
        });
      }
    }

    this.logger.log(`SLA sweep: ${openTickets.length} open tickets checked, ${breachedCount} breached`);
  }
}
