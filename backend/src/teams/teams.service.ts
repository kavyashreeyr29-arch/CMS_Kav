import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { AuditLogService, diffFields } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

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

  async create(dto: CreateTeamDto, actor: AuthenticatedUser) {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        leadUserId: dto.leadUserId,
        memberships: dto.memberUserIds
          ? { create: dto.memberUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: { lead: { select: SAFE_USER_SELECT }, memberships: true },
    });

    await this.auditLog.record({
      orgId: actor.orgId, actorUserId: actor.id, action: 'team.created',
      targetType: 'Team', targetId: team.id, targetLabel: team.name,
      changes: { memberCount: { before: null, after: team.memberships.length } },
    });
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);

    if (dto.memberUserIds) {
      await this.prisma.teamMembership.deleteMany({ where: { teamId: id } });
    }

    const team = await this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.leadUserId !== undefined && { leadUserId: dto.leadUserId }),
        ...(dto.memberUserIds && {
          memberships: { create: dto.memberUserIds.map((userId) => ({ userId })) },
        }),
      },
      include: TEAM_INCLUDE,
    });

    const changes = diffFields(
      { name: existing.name, leadUserId: existing.leadUserId, memberCount: existing.memberships.length },
      { name: team.name, leadUserId: team.leadUserId, memberCount: team.memberships.length },
    );
    if (changes) {
      await this.auditLog.record({
        orgId: actor.orgId, actorUserId: actor.id, action: 'team.updated',
        targetType: 'Team', targetId: team.id, targetLabel: team.name,
        changes,
      });
    }
    return team;
  }
}
