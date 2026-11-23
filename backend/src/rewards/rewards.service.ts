import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

const REWARD_INCLUDE = {
  createdBy: { select: SAFE_USER_SELECT },
  _count: { select: { tickets: true, documents: true } },
} as const;

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async findAllForProject(projectCode: string, user: AuthenticatedUser) {
    const project = await this.projects.findOne(projectCode, user);
    return this.prisma.reward.findMany({
      where: { projectId: project.id },
      include: REWARD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateRewardDto) {
    const project = await this.projects.findOne(dto.projectCode, user);
    return this.prisma.reward.create({
      data: {
        projectId: project.id,
        name: dto.name,
        description: dto.description,
        rewardType: dto.rewardType,
        value: dto.value,
        createdByUserId: user.id,
      },
      include: REWARD_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateRewardDto) {
    const existing = await this.prisma.reward.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reward not found');
    return this.prisma.reward.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rewardType !== undefined && { rewardType: dto.rewardType }),
        ...(dto.value !== undefined && { value: dto.value }),
      },
      include: REWARD_INCLUDE,
    });
  }
}
