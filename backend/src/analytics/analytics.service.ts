import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { RolePermissions } from '../common/permissions/role-permissions';
import { ticketVisibilityWhere } from '../common/permissions/ticket-scope';

const OPEN_STATUSES = ['Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Reopened'];
const CLOSED_STATUSES = ['Completed', 'Closed'];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * prd.md §8.2 — project-wise performance table. Was Admin-only and
   * unconditionally org-wide; now gated by `adminAnalytics` (also granted to
   * Director/PM/Lead/Manager) and scoped the same way
   * ProjectsService.findAll() scopes its own project list — 'team' sees only
   * their led team(s)' projects, everyone else with the permission sees all.
   */
  async projectWise(user: AuthenticatedUser, perms: RolePermissions) {
    const where: Prisma.ProjectWhereInput = perms.scope === 'team' ? { teamId: { in: user.ledTeamIds } } : {};
    const projects = await this.prisma.project.findMany({
      where,
      include: { tickets: { include: { timeEntries: { select: { durationMinutes: true } } } } },
    });

    return projects.map((project) => {
      const tickets = project.tickets;
      const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
      const closed = tickets.filter((t) => CLOSED_STATUSES.includes(t.status));
      const clientTickets = tickets.filter((t) => t.source === 'ClientPortal');

      const avgAgeDays = open.length
        ? Math.round(
            open.reduce((sum, t) => sum + daysBetween(t.createdAt, new Date()), 0) / open.length,
          )
        : 0;

      // docs/prd-phase2.md §6.3 — project-wise summary now also carries
      // total hours spent (sum of every ticket's time entries).
      const hoursSpent = Math.round(
        (tickets.reduce((sum, t) => sum + t.timeEntries.reduce((s, e) => s + Number(e.durationMinutes ?? 0), 0), 0) / 60) * 10,
      ) / 10;

      return {
        projectCode: project.code,
        projectName: project.name,
        total: tickets.length,
        open: open.length,
        closed: closed.length,
        avgAgeDays,
        hoursSpent,
        clientTotal: clientTickets.length,
        clientOpen: clientTickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
        clientClosed: clientTickets.filter((t) => CLOSED_STATUSES.includes(t.status)).length,
      };
    });
  }

  /**
   * docs/prd-phase2.md §6.3/§6.4 — org-wide hours, a per-developer
   * productivity table (hours + distinct tickets worked), and a hours/tickets
   * breakdown by Business Category. All scoped by `ticketVisibilityWhere` via
   * the time entry's parent ticket, same as every other ticket-adjacent read.
   */
  async productivity(user: AuthenticatedUser, perms: RolePermissions, sinceDays = 90) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const entries = await this.prisma.timeEntry.findMany({
      where: { startedAt: { gte: since }, ticket: ticketVisibilityWhere(user, perms) },
      select: {
        durationMinutes: true,
        ticketId: true,
        userId: true,
        user: { select: { id: true, name: true } },
        ticket: { select: { businessCategory: true } },
      },
    });

    const totalHours = round1(entries.reduce((s, e) => s + Number(e.durationMinutes ?? 0), 0) / 60);

    const byUser = new Map<string, { name: string; hours: number; ticketIds: Set<string> }>();
    for (const e of entries) {
      const row = byUser.get(e.userId) ?? { name: e.user?.name ?? 'Unknown', hours: 0, ticketIds: new Set<string>() };
      row.hours += Number(e.durationMinutes ?? 0) / 60;
      row.ticketIds.add(e.ticketId);
      byUser.set(e.userId, row);
    }
    const perDeveloper = [...byUser.entries()]
      .map(([userId, r]) => ({ userId, name: r.name, hours: round1(r.hours), ticketCount: r.ticketIds.size }))
      .sort((a, b) => b.hours - a.hours);

    const byCategory = new Map<string, { hours: number; ticketIds: Set<string> }>();
    for (const e of entries) {
      const cat = e.ticket.businessCategory ?? 'Uncategorized';
      const row = byCategory.get(cat) ?? { hours: 0, ticketIds: new Set<string>() };
      row.hours += Number(e.durationMinutes ?? 0) / 60;
      row.ticketIds.add(e.ticketId);
      byCategory.set(cat, row);
    }
    const businessCategoryBreakdown = [...byCategory.entries()]
      .map(([category, r]) => ({ category, hours: round1(r.hours), ticketCount: r.ticketIds.size }))
      .sort((a, b) => b.hours - a.hours);

    return { sinceDays, totalHours, perDeveloper, businessCategoryBreakdown };
  }

  /**
   * prd.md §8.1 / §12 — shared Trend Summary data source (created vs.
   * closed, per period, plus SLA/avg-resolution deltas), scoped by role and
   * optionally to one project.
   */
  async trend(user: AuthenticatedUser, perms: RolePermissions, period: 'month' | 'quarter' | 'year', projectCode?: string) {
    const bucketSize = period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const bucketCount = 6;
    const since = new Date(Date.now() - bucketSize * bucketCount * 24 * 60 * 60 * 1000);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        AND: [
          ticketVisibilityWhere(user, perms),
          projectCode ? { project: { code: projectCode.toUpperCase() } } : {},
          { createdAt: { gte: since } },
        ],
      },
      select: { createdAt: true, updatedAt: true, status: true },
    });

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = new Date(since.getTime() + i * bucketSize * 24 * 60 * 60 * 1000);
      const bucketEnd = new Date(bucketStart.getTime() + bucketSize * 24 * 60 * 60 * 1000);
      const created = tickets.filter((t) => t.createdAt >= bucketStart && t.createdAt < bucketEnd).length;
      const closed = tickets.filter(
        (t) => CLOSED_STATUSES.includes(t.status) && t.updatedAt >= bucketStart && t.updatedAt < bucketEnd,
      ).length;
      return { period: bucketStart.toISOString().slice(0, 10), created, closed };
    });

    return { period, projectCode: projectCode ?? 'ALL', buckets };
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
