import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TimeEntrySource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { RolePermissions, WorkHoursVisibility } from '../common/permissions/role-permissions';
import { getGrantedTeamIds } from '../common/permissions/team-access';
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

interface TeamTimesheetSummaryRow {
  user_id: string;
  name: string;
  seniority: string | null;
  automated_minutes: number;
  manual_minutes: number;
  tickets_touched: number;
}

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * A role's workHoursVisibility is a static default (role-permissions.ts);
   * Team.hoursViewerUserIds/hoursViewerRoleIds let an admin grant a
   * specific person or role team-level access to one team's hours on top
   * of that default — e.g. an Operations person (default 'none') added to
   * one team's hoursViewerUserIds can see that team's hours without their
   * role changing anywhere else. 'org' already sees everything, so grants
   * can't add anything there — skip the lookup.
   */
  async effectiveWorkHoursVisibility(user: AuthenticatedUser, perms: RolePermissions): Promise<WorkHoursVisibility> {
    if (perms.workHoursVisibility === 'org') return 'org';
    const grantedTeamIds = await getGrantedTeamIds(this.prisma, user);
    return grantedTeamIds.length > 0 ? 'team' : perms.workHoursVisibility;
  }

  // workHoursVisibility gates *who* the rollup can include: an org-wide
  // viewer sees everyone, a team-scoped viewer (the role default, or anyone
  // granted access to a specific team — see getGrantedTeamIds) sees only
  // their team(s), and an 'own' viewer only ever sees themselves regardless
  // of query params. Shared by workHours()/dailyBreakdown()/teamSummary()
  // so the three can never drift.
  private async resolveScopedUserIds(
    user: AuthenticatedUser,
    perms: RolePermissions,
    teamIds?: string[],
    memberUserId?: string,
  ): Promise<string[] | undefined> {
    let scopedUserIds: string[] | undefined;
    if (perms.workHoursVisibility === 'org') {
      scopedUserIds = undefined;
    } else {
      const grantedTeamIds = await getGrantedTeamIds(this.prisma, user);
      if (grantedTeamIds.length > 0) {
        const memberships = await this.prisma.teamMembership.findMany({
          where: { teamId: { in: grantedTeamIds } },
          select: { userId: true },
        });
        scopedUserIds = [...new Set(memberships.map((m) => m.userId))];
        // A grant widens visibility to those teams on top of always still
        // seeing your own hours, for a role whose own default is 'own'.
        if (perms.workHoursVisibility === 'own' && !scopedUserIds.includes(user.id)) {
          scopedUserIds.push(user.id);
        }
      } else if (perms.workHoursVisibility === 'own') {
        scopedUserIds = [user.id];
      } else {
        // 'team' default with nothing led/granted, or 'none' with no
        // grants — resolved to "nobody"; the controller rejects the
        // 'none'-with-no-grants case up front via effectiveWorkHoursVisibility.
        scopedUserIds = [];
      }
    }

    // Further narrow to an explicitly requested team/member — intersected
    // with whatever scope already applies (rather than trusted outright),
    // so nobody can widen their own access by just passing a param; an
    // unrestricted ('org') viewer is the only case with nothing to
    // intersect against yet.
    if (teamIds?.length) {
      const memberships = await this.prisma.teamMembership.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true },
      });
      const requestedIds = memberships.map((m) => m.userId);
      scopedUserIds = scopedUserIds ? scopedUserIds.filter((id) => requestedIds.includes(id)) : requestedIds;
    }
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
  // listMine()/createManual()/deleteManual() operate on a single userId at a
  // time — always the caller's own for create/delete, but listMine() can
  // also be pointed at someone else's entries for the team-overview drill-
  // down below, gated by canViewUser() (enforced in the controller).

  /** Can `user` see `targetUserId`'s timesheet — always true for yourself, otherwise the same org/team visibility Team Hours already uses (including any per-team grant). */
  async canViewUser(user: AuthenticatedUser, perms: RolePermissions, targetUserId: string): Promise<boolean> {
    if (targetUserId === user.id) return true;
    const effective = await this.effectiveWorkHoursVisibility(user, perms);
    if (effective === 'org') return true;
    if (effective === 'team') {
      const scopedUserIds = await this.resolveScopedUserIds(user, perms);
      return !!scopedUserIds?.includes(targetUserId);
    }
    return false;
  }

  /**
   * Per-person automated vs. manual totals for the "Team" overview shown to
   * org/team-visibility roles (Admin/Director/PM see everyone, Lead sees
   * their led team) — the equivalent of workHours() above, but split by
   * TimeEntry.source instead of lumping timer and manual time together.
   */
  async teamSummary(
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

    const rows = await this.prisma.$queryRaw<TeamTimesheetSummaryRow[]>(Prisma.sql`
      SELECT u.id AS user_id, u.name, u.seniority,
             SUM(CASE WHEN te.source = 'timer' THEN EXTRACT(EPOCH FROM (COALESCE(te.ended_at, now()) - te.started_at)) / 60 ELSE 0 END) AS automated_minutes,
             SUM(CASE WHEN te.source = 'manual' THEN EXTRACT(EPOCH FROM (te.ended_at - te.started_at)) / 60 ELSE 0 END) AS manual_minutes,
             COUNT(DISTINCT te.ticket_id) FILTER (WHERE te.source = 'timer') AS tickets_touched
      FROM time_entries te
      JOIN users u ON u.id = te.user_id
      WHERE te.started_at::date BETWEEN ${rangeStart}::date AND ${rangeEnd}::date
        AND u.org_id = ${user.orgId}
        ${scopedUserIds?.length ? Prisma.sql`AND u.id IN (${Prisma.join(scopedUserIds)})` : Prisma.empty}
      GROUP BY u.id, u.name, u.seniority
      ORDER BY u.name ASC
    `);

    return rows.map((r) => ({
      ...r,
      automated_minutes: Number(r.automated_minutes),
      manual_minutes: Number(r.manual_minutes),
      tickets_touched: Number(r.tickets_touched),
    }));
  }

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
