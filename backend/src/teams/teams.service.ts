import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { AuditLogService, diffFields } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { roleExists } from '../common/permissions/role-permissions';

const TEAM_INCLUDE = {
  lead: { select: SAFE_USER_SELECT },
  memberships: { include: { user: { select: SAFE_USER_SELECT } } },
};

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.team.findMany({
      include: TEAM_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: TEAM_INCLUDE,
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  private assertValidRoleIds(roleIds?: string[]) {
    const unknown = roleIds?.filter((id) => !roleExists(id));
    if (unknown?.length) {
      throw new BadRequestException(`Unknown role id(s): ${unknown.join(', ')}`);
    }
  }

  /**
   * Renders a team-hours grant list as names/labels rather than raw ids —
   * an audit log entry reading "hoursViewerUserIds: f3d835b8-... →" tells
   * an admin nothing about who was actually granted access. Looks up both
   * old and new ids in one query each so a before/after diff only needs
   * two round-trips regardless of how much the list changed.
   */
  private async describeGrants(beforeIds: string[], afterIds: string[], roles: boolean) {
    const allIds = [...new Set([...beforeIds, ...afterIds])];
    if (allIds.length === 0) return { before: '', after: '' };
    const rows = roles
      ? await this.prisma.role.findMany({ where: { id: { in: allIds } }, select: { id: true, label: true } })
      : await this.prisma.user.findMany({ where: { id: { in: allIds } }, select: { id: true, name: true } });
    const nameById = new Map(rows.map((r) => [r.id, roles ? (r as { label: string }).label : (r as { name: string }).name]));
    const describe = (ids: string[]) => [...ids].sort().map((id) => nameById.get(id) ?? id).join(', ');
    return { before: describe(beforeIds), after: describe(afterIds) };
  }

  async create(dto: CreateTeamDto, actor: AuthenticatedUser) {
    this.assertValidRoleIds(dto.hoursViewerRoleIds);
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        leadUserId: dto.leadUserId,
        hoursViewerUserIds: dto.hoursViewerUserIds ?? [],
        hoursViewerRoleIds: dto.hoursViewerRoleIds ?? [],
        memberships: dto.memberUserIds
          ? { create: dto.memberUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: { lead: { select: SAFE_USER_SELECT }, memberships: true },
    });

    const changes: Record<string, { before: unknown; after: unknown }> = {
      memberCount: { before: null, after: team.memberships.length },
    };
    if (team.hoursViewerUserIds.length) {
      changes['Extra hours viewers'] = { before: '', after: (await this.describeGrants([], team.hoursViewerUserIds, false)).after };
    }
    if (team.hoursViewerRoleIds.length) {
      changes['Extra hours viewer roles'] = { before: '', after: (await this.describeGrants([], team.hoursViewerRoleIds, true)).after };
    }
    await this.auditLog.record({
      orgId: actor.orgId, actorUserId: actor.id, action: 'team.created',
      targetType: 'Team', targetId: team.id, targetLabel: team.name,
      changes,
    });
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);
    this.assertValidRoleIds(dto.hoursViewerRoleIds);

    if (dto.memberUserIds) {
      await this.prisma.teamMembership.deleteMany({ where: { teamId: id } });
    }

    const team = await this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.leadUserId !== undefined && { leadUserId: dto.leadUserId }),
        ...(dto.hoursViewerUserIds !== undefined && { hoursViewerUserIds: dto.hoursViewerUserIds }),
        ...(dto.hoursViewerRoleIds !== undefined && { hoursViewerRoleIds: dto.hoursViewerRoleIds }),
        ...(dto.memberUserIds && {
          memberships: { create: dto.memberUserIds.map((userId) => ({ userId })) },
        }),
      },
      include: TEAM_INCLUDE,
    });

    const changes = diffFields(
      { name: existing.name, leadUserId: existing.leadUserId, memberCount: existing.memberships.length },
      { name: team.name, leadUserId: team.leadUserId, memberCount: team.memberships.length },
    ) ?? {};

    const viewerNames = await this.describeGrants(existing.hoursViewerUserIds, team.hoursViewerUserIds, false);
    if (viewerNames.before !== viewerNames.after) changes['Extra hours viewers'] = viewerNames;
    const viewerRoles = await this.describeGrants(existing.hoursViewerRoleIds, team.hoursViewerRoleIds, true);
    if (viewerRoles.before !== viewerRoles.after) changes['Extra hours viewer roles'] = viewerRoles;

    if (Object.keys(changes).length > 0) {
      await this.auditLog.record({
        orgId: actor.orgId, actorUserId: actor.id, action: 'team.updated',
        targetType: 'Team', targetId: team.id, targetLabel: team.name,
        changes,
      });
    }
    return team;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const team = await this.findOne(id);
    // Projects assigned to this team keep existing (Project.teamId just
    // goes null, per schema.prisma's implicit SetNull) — deleting a team
    // is a roster change, not a reason to touch the projects it led.
    await this.prisma.team.delete({ where: { id } });
    await this.auditLog.record({
      orgId: actor.orgId, actorUserId: actor.id, action: 'team.deleted',
      targetType: 'Team', targetId: team.id, targetLabel: team.name,
    });
    return { success: true };
  }
}
