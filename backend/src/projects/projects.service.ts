import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { RolePermissions } from '../common/permissions/role-permissions';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { AuditLogService } from '../audit-log/audit-log.service';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.Open,
  TicketStatus.Assigned,
  TicketStatus.InProgress,
  TicketStatus.InReview,
  TicketStatus.QATesting,
  TicketStatus.Reopened,
];

// docs/prd-phase2.md §11 — these tiers always see every project they'd
// otherwise be scoped to (role-scope filtering still applies, e.g. Lead's
// team filter) and are never membership-gated.
function isLeadershipTier(user: AuthenticatedUser): boolean {
  return ['admin', 'director', 'pm'].includes(user.baseRoleId) || user.seniority === 'lead' || user.seniority === 'manager';
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(user: AuthenticatedUser, perms: RolePermissions) {
    const where: Prisma.ProjectWhereInput =
      perms.scope === 'team' ? { teamId: { in: user.ledTeamIds } } : {};

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        pm: { select: SAFE_USER_SELECT },
        team: true,
        documents: true,
        _count: { select: { tickets: true } },
        // Health dot on the project card (Projects.tsx) — same ratio-based
        // heuristic as the Dashboard's per-project health panel.
        tickets: { where: { status: { in: OPEN_STATUSES } }, select: { dueDate: true } },
        members: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const leadershipTier = isLeadershipTier(user);
    return projects
      // docs/prd-phase2.md §11 — a project with no members configured stays
      // visible to everyone the role-scope filter already allows, so this
      // never retroactively locks anyone out of a pre-existing project.
      .filter((p) => leadershipTier || p.members.length === 0 || p.members.some((m) => m.userId === user.id))
      .map(({ tickets, members, ...p }) => ({
        ...p,
        openCount: tickets.length,
        overdueCount: tickets.filter((t) => t.dueDate && t.dueDate < now).length,
        memberCount: members.length,
      }));
  }

  async findOne(code: string, user?: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { code },
      include: {
        pm: { select: SAFE_USER_SELECT },
        team: true,
        documents: true,
        members: { include: { user: { select: SAFE_USER_SELECT } } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Membership gate only applies when a caller identity was passed in —
    // internal callers (update/addDocument/getDocumentDownloadUrl below)
    // intentionally call this unscoped, since they're sub-resource
    // operations on a project the caller already navigated to, not the
    // primary "can I see this project" read path.
    if (user && !isLeadershipTier(user) && project.members.length > 0 && !project.members.some((m) => m.userId === user.id)) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  /** docs/prd-phase2.md §11 — Admin or the project's own PM manages its member list. */
  async addMember(code: string, actingUser: AuthenticatedUser, userId: string) {
    const project = await this.findOne(code);
    if (actingUser.baseRoleId !== 'admin' && project.pmUserId !== actingUser.id) {
      throw new ForbiddenException('Only Admin or this project\'s PM can manage its access list');
    }
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: {},
      create: { projectId: project.id, userId, addedBy: actingUser.id },
    });
    return this.findOne(code);
  }

  async removeMember(code: string, actingUser: AuthenticatedUser, userId: string) {
    const project = await this.findOne(code);
    if (actingUser.baseRoleId !== 'admin' && project.pmUserId !== actingUser.id) {
      throw new ForbiddenException('Only Admin or this project\'s PM can manage its access list');
    }
    await this.prisma.projectMember.deleteMany({ where: { projectId: project.id, userId } });
    return this.findOne(code);
  }

  create(dto: CreateProjectDto, actingUserId: string) {
    return this.prisma.project.create({
      data: {
        code: dto.code.trim().toUpperCase().replace(/\s+/g, ''),
        name: dto.name,
        client: dto.client,
        pmUserId: dto.pmUserId,
        teamId: dto.teamId,
        status: dto.status,
        priority: dto.priority,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        description: dto.description,
        members: dto.memberUserIds?.length
          ? { create: dto.memberUserIds.map((userId) => ({ userId, addedBy: actingUserId })) }
          : undefined,
      },
      include: { pm: { select: SAFE_USER_SELECT }, team: true, documents: true, members: true },
    });
  }

  async update(code: string, dto: UpdateProjectDto) {
    await this.findOne(code);
    return this.prisma.project.update({
      where: { code },
      data: {
        ...dto,
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      },
      include: { pm: { select: SAFE_USER_SELECT }, team: true, documents: true },
    });
  }

  /**
   * Admin-only. `Ticket.projectId` is a required FK with no cascade
   * (schema.prisma), so Postgres would already reject this while any
   * ticket remains — checked up front here for a readable error instead of
   * a raw FK-violation 500. Everything else attached to a project
   * (documents, members, campaigns, rewards, to-dos, notes) cascades.
   */
  async remove(code: string, actor: AuthenticatedUser) {
    const project = await this.findOne(code);
    const ticketCount = await this.prisma.ticket.count({ where: { projectId: project.id } });
    if (ticketCount > 0) {
      throw new ConflictException(
        `Cannot delete ${project.code} — it still has ${ticketCount} ticket${ticketCount === 1 ? '' : 's'}. Move or delete them first.`,
      );
    }
    await this.prisma.project.delete({ where: { id: project.id } });
    await this.auditLog.record({
      orgId: actor.orgId, actorUserId: actor.id, action: 'project.deleted',
      targetType: 'Project', targetId: project.id, targetLabel: `${project.code} — ${project.name}`,
    });
    return { success: true };
  }

  async addDocument(code: string, uploadedBy: string, dto: AddDocumentDto) {
    const project = await this.findOne(code);
    return this.prisma.projectDocument.create({
      data: {
        projectId: project.id,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeKind: dto.mimeKind,
        storageKey: dto.storageKey,
        uploadedBy,
        section: dto.section,
        campaignId: dto.campaignId,
        rewardId: dto.rewardId,
      },
    });
  }

  requestDocumentUploadUrl(fileName: string, projectCode: string) {
    const key = this.storage.buildStorageKey('projects', projectCode, fileName);
    return this.storage.getUploadUrl(key).then((res) => ({ ...res, storageKey: key }));
  }

  async getDocumentDownloadUrl(code: string, documentId: string) {
    const project = await this.findOne(code); // enforces the project exists
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId: project.id },
    });
    if (!document) throw new NotFoundException('Document not found');
    return this.storage.getDownloadUrl(document.storageKey);
  }
}
