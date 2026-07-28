import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(orgId: string, includeInactive = false) {
    return this.prisma.label.findMany({
      where: { orgId, ...(includeInactive ? {} : { active: true }) },
      include: { _count: { select: { tickets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(orgId: string, createdBy: string, dto: CreateLabelDto) {
    const existing = await this.prisma.label.findFirst({ where: { orgId, name: dto.name.trim() } });
    if (existing) throw new BadRequestException(`Label "${dto.name}" already exists`);
    return this.prisma.label.create({ data: { orgId, name: dto.name.trim(), createdBy } });
  }

  // Soft delete: tickets already using this label keep it for historical
  // reporting (prd.md §11); it just drops out of the create-ticket picker.
  async remove(id: string) {
    const label = await this.prisma.label.findUnique({ where: { id } });
    if (!label) throw new NotFoundException('Label not found');
    return this.prisma.label.update({ where: { id }, data: { active: false } });
  }
}
