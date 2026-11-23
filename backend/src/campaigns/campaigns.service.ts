import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

const CAMPAIGN_INCLUDE = {
  createdBy: { select: SAFE_USER_SELECT },
  _count: { select: { tickets: true, documents: true } },
} as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async findAllForProject(projectCode: string, user: AuthenticatedUser) {
    const project = await this.projects.findOne(projectCode, user);
    return this.prisma.campaign.findMany({
      where: { projectId: project.id },
      include: CAMPAIGN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateCampaignDto) {
    const project = await this.projects.findOne(dto.projectCode, user);
    return this.prisma.campaign.create({
      data: {
        projectId: project.id,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdByUserId: user.id,
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  /**
   * Org-wide "how many tickets were raised against a campaign" data —
   * returns the raw campaign-linked ticket rows so the caller (Analytics
   * page) can bucket by month/quarter/year using the same client-side period
   * logic every other Analytics panel already uses, rather than duplicating
   * date-bucketing on the server.
   */
  async ticketSummary() {
    const tickets = await this.prisma.ticket.findMany({
      where: { campaignId: { not: null } },
      select: {
        id: true,
        createdAt: true,
        campaignId: true,
        campaign: { select: { name: true } },
        project: { select: { code: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return tickets.map((t) => ({
      ticketId: t.id,
      createdAt: t.createdAt,
      campaignId: t.campaignId as string,
      campaignName: t.campaign?.name ?? 'Unknown campaign',
      projectCode: t.project.code,
    }));
  }
}
