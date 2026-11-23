import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { CreateNoteDto } from './dto/create-note.dto';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

const NOTE_INCLUDE = { author: { select: SAFE_USER_SELECT } } as const;

@Injectable()
export class ProjectNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async findAllForProject(projectCode: string, user: AuthenticatedUser) {
    const project = await this.projects.findOne(projectCode, user);
    return this.prisma.projectNote.findMany({
      where: { projectId: project.id },
      include: NOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateNoteDto) {
    const project = await this.projects.findOne(dto.projectCode, user);
    return this.prisma.projectNote.create({
      data: { projectId: project.id, authorUserId: user.id, body: dto.body },
      include: NOTE_INCLUDE,
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.projectNote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Note not found');
    if (existing.authorUserId !== user.id && user.baseRoleId !== 'admin') {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.prisma.projectNote.delete({ where: { id } });
    return { id };
  }
}
