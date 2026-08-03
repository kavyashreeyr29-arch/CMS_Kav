import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TimeEntrySource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { RolePermissions } from '../common/permissions/role-permissions';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';

interface WorkHoursRow {
  user_id: string;
  name: string;
  seniority: string | null;
  hours_today: number;
}

interface DailyWorkHoursRow {
  user_id: string;
  name: string;
  seniority: string | null;
  work_date: Date;
  hours: number;
}

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // workHoursVisibility gates *who* the rollup can include: an org-wide
  // viewer sees everyone, a team-scoped Lead sees only their team(s), and an
  // 'own' viewer only ever sees themselves regardless of query params.
  // Shared by workHours() and dailyBreakdown() so the two can never drift.
  private async resolveScopedUserIds(
    user: AuthenticatedUser,
    perms: RolePermissions,
    teamIds?: string[],
    memberUserId?: string,
  ): Promise<string[] | undefined> {
    let scopedUserIds: string[] | undefined;
    if (perms.workHoursVisibility === 'own') {
      scopedUserIds = [user.id];
    } else if (perms.workHoursVisibility === 'team') {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { teamId: { in: user.ledTeamIds } },
        select: { userId: true },
      });
      scopedUserIds = memberships.map((m) => m.userId);
    } else if (teamIds?.length) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true },
      });
      scopedUserIds = memberships.map((m) => m.userId);
    }

    // docs/prd-phase2.md §8 — "or for specific member only" — intersect with
    // whatever scope already applies rather than trusting the param outright,
    // so a team-scoped Lead can't query an out-of-team member's hours by id.
    if (memberUserId) {
      scopedUserIds = scopedUserIds ? scopedUserIds.filter((id) => id === memberUserId) : [memberUserId];
    }
    return scopedUserIds;
  }

  /**
   * LLD §4.6 — hours logged per user across a date range, scoped by role.
   * docs/prd-phase2.md §8 — `org`/`team`-visibility roles (Admin, Director,
   * PM, Lead, Tech Manager) may pass startDate/endDate for a real range;
   * everyone else is implicitly pinned to today regardless of what they send
   * (enforced by the controller, not here — see workHoursVisibility check).
   */
  async workHours(
    user: AuthenticatedUser,
    perms: RolePermissions,
    startDate?: string,
    endDate?: string,
    teamIds?: string[],
    memberUserId?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const rangeStart = startDate ?? today;
    const rangeEnd = endDate ?? startDate ?? today;

    const scopedUserIds = await this.resolveScopedUserIds(user, perms, teamIds, memberUserId);

    // `Prisma.join([])` throws on an empty array rather than producing valid
    // SQL — a Lead with no team members yet (or a team with nobody in it)
    // would otherwise 500 here. An empty scoped set unambiguously means
    // "nobody to report on", so short-circuit instead of querying.
    if (scopedUserIds && scopedUserIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<WorkHoursRow[]>(Prisma.sql`
      SELECT u.id AS user_id, u.name, u.seniority,
             SUM(EXTRACT(EPOCH FROM (COALESCE(te.ended_at, now()) - te.started_at)) / 3600) AS hours_today
      FROM time_entries te
      JOIN users u ON u.id = te.user_id
      WHERE te.started_at::date BETWEEN ${rangeStart}::date AND ${rangeEnd}::date
        AND u.org_id = ${user.orgId}
        ${scopedUserIds?.length ? Prisma.sql`AND u.id IN (${Prisma.join(scopedUserIds)})` : Prisma.empty}
      GROUP BY u.id, u.name, u.seniority
      ORDER BY hours_today DESC
    `);

    return rows.map((r) => ({ ...r, hours_today: Number(r.hours_today) }));
  }

  /**
   * Per-person, per-day hours over a range — the "was this a full
   * productive day" view (CHANGELOG.md), distinct from workHours()'s
   * range-total rollup. Same scoping rules, just grouped one level finer.
   */
  async dailyBreakdown(
    user: AuthenticatedUser,
    perms: RolePermissions,
    startDate?: string,
    endDate?: string,
    teamIds?: string[],
    memberUserId?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const rangeStart = startDate ?? today;
    const rangeEnd = endDate ?? startDate ?? today;

    const scopedUserIds = await this.resolveScopedUserIds(user, perms, teamIds, memberUserId);
    if (scopedUserIds && scopedUserIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.$queryRaw<DailyWorkHoursRow[]>(Prisma.sql`
      SELECT u.id AS user_id, u.name, u.seniority, te.started_at::date AS work_date,
             SUM(EXTRACT(EPOCH FROM (COALESCE(te.ended_at, now()) - te.started_at)) / 3600) AS hours
      FROM time_entries te
      JOIN users u ON u.id = te.user_id
      WHERE te.started_at::date BETWEEN ${rangeStart}::date AND ${rangeEnd}::date
        AND u.org_id = ${user.orgId}
        ${scopedUserIds?.length ? Prisma.sql`AND u.id IN (${Prisma.join(scopedUserIds)})` : Prisma.empty}
      GROUP BY u.id, u.name, u.seniority, te.started_at::date
      ORDER BY u.name ASC, work_date ASC
    `);

    return rows.map((r) => ({ ...r, hours: Number(r.hours), work_date: r.work_date.toISOString().slice(0, 10) }));
  }

  /**
   * "View history" drill-down (docs/prd-phase2.md §8): which tickets a
   * person logged time against over a date range — title, ticket number,
   * and hours against each, nothing more.
   */
  drillDown(userId: string, startDate: string, endDate?: string) {
    const rangeEnd = endDate ?? startDate;
    return this.prisma.timeEntry.findMany({
      where: {
        userId,
        startedAt: { gte: new Date(`${startDate}T00:00:00Z`), lt: new Date(`${rangeEnd}T23:59:59.999Z`) },
      },
      include: { ticket: { select: { id: true, displayId: true, title: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  // -- Personal timesheet (My Timesheet page) -----------------------------
  // Everything below is self-scoped by construction (userId always ties back
  // to the caller) — unlike workHours()/dailyBreakdown() above, there's no
  // visibility gate to apply beyond "can this role track time at all",
  // enforced in the controller.

  /** Both timer-derived and manual entries for one person, oldest first — the frontend groups the timer ones by ticket itself. */
  listMine(userId: string, startDate: string, endDate?: string) {
    const rangeEnd = endDate ?? startDate;
    return this.prisma.timeEntry.findMany({
      where: {
        userId,
        startedAt: { gte: new Date(`${startDate}T00:00:00Z`), lt: new Date(`${rangeEnd}T23:59:59.999Z`) },
      },
      include: { ticket: { select: { id: true, displayId: true, title: true } } },
      orderBy: { startedAt: 'asc' },
    });
  }

  async createManual(user: AuthenticatedUser, dto: CreateManualTimeEntryDto) {
    const startedAt = new Date(`${dto.date}T${dto.fromTime}:00`);
    const endedAt = new Date(`${dto.date}T${dto.toTime}:00`);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
      throw new BadRequestException('Invalid date/time');
    }
    if (endedAt <= startedAt) {
      throw new BadRequestException('End time must be after start time');
    }

    if (dto.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
      if (!ticket) throw new BadRequestException('Ticket not found');
    }

    const durationMinutes = Math.round(((endedAt.getTime() - startedAt.getTime()) / 60000) * 100) / 100;

    const entry = await this.prisma.timeEntry.create({
      data: {
        ticketId: dto.ticketId,
        userId: user.id,
        startedAt,
        endedAt,
        durationMinutes,
        source: TimeEntrySource.manual,
        taskName: dto.taskName,
      },
      include: { ticket: { select: { id: true, displayId: true, title: true } } },
    });

    if (dto.ticketId) {
      await this.activityLog.record({
        ticketId: dto.ticketId,
        actorUserId: user.id,
        actionType: 'timer_manual_entry',
        actionText: `logged ${durationMinutes.toFixed(0)}m manually on ${dto.date} — "${dto.taskName}"`,
      });
    }

    return entry;
  }

  async deleteManual(id: string, user: AuthenticatedUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.source !== TimeEntrySource.manual) {
      throw new BadRequestException('Only manually-entered rows can be deleted — timer-derived entries are the audit record for a ticket');
    }
    if (entry.userId !== user.id) throw new ForbiddenException('You can only delete your own manual entries');
    await this.prisma.timeEntry.delete({ where: { id } });
    return { id };
  }
}
