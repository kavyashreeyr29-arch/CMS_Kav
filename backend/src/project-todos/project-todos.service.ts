import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';

const TODO_INCLUDE = {
  assignee: { select: SAFE_USER_SELECT },
  createdBy: { select: SAFE_USER_SELECT },
} as const;

@Injectable()
export class ProjectTodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async findAllForProject(projectCode: string, user: AuthenticatedUser) {
    const project = await this.projects.findOne(projectCode, user);
    return this.prisma.projectTodoItem.findMany({
      where: { projectId: project.id },
      include: TODO_INCLUDE,
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(user: AuthenticatedUser, dto: CreateTodoDto) {
    const project = await this.projects.findOne(dto.projectCode, user);
    return this.prisma.projectTodoItem.create({
      data: {
        projectId: project.id,
        title: dto.title,
        assigneeUserId: dto.assigneeUserId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdByUserId: user.id,
      },
      include: TODO_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTodoDto) {
    const existing = await this.prisma.projectTodoItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('To-do item not found');
    const doneChanged = dto.done !== undefined && dto.done !== existing.done;
    return this.prisma.projectTodoItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.done !== undefined && { done: dto.done }),
        ...(dto.assigneeUserId !== undefined && { assigneeUserId: dto.assigneeUserId || null }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(doneChanged && { completedAt: dto.done ? new Date() : null }),
      },
      include: TODO_INCLUDE,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.projectTodoItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('To-do item not found');
    await this.prisma.projectTodoItem.delete({ where: { id } });
    return { id };
  }
}
