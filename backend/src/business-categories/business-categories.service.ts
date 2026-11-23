import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';

// Was a fixed 3-value Prisma enum (InnovateX/ElevatozX/AccquareX) —
// CHANGELOG.md "admin should be able to add... business categories". Same
// soft-delete shape as LabelsService, since Ticket.businessCategory is now a
// plain validated string rather than an enum/FK.
@Injectable()
export class BusinessCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(orgId: string, includeInactive = false) {
    return this.prisma.businessCategory.findMany({
      where: { orgId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async exists(orgId: string, name: string): Promise<boolean> {
    const found = await this.prisma.businessCategory.findFirst({ where: { orgId, name, active: true } });
    return !!found;
  }

  async create(orgId: string, createdBy: string, dto: CreateBusinessCategoryDto) {
    const existing = await this.prisma.businessCategory.findFirst({ where: { orgId, name: dto.name.trim() } });
    if (existing) throw new BadRequestException(`Business category "${dto.name}" already exists`);
    return this.prisma.businessCategory.create({ data: { orgId, name: dto.name.trim(), createdBy } });
  }

  async remove(id: string) {
    const category = await this.prisma.businessCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Business category not found');
    return this.prisma.businessCategory.update({ where: { id }, data: { active: false } });
  }
}
