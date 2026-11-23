import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/permissions/effective-permissions';
import { RolePermissions } from '../common/permissions/role-permissions';
import { ticketVisibilityWhere } from '../common/permissions/ticket-scope';
import { SAFE_USER_SELECT } from '../common/prisma/safe-user-select';

const RESULT_LIMIT = 8;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: AuthenticatedUser, perms: RolePermissions, q: string) {
    const query = q.trim();
    if (!query) return { tickets: [], projects: [], people: [] };

    const [tickets, projects, people] = await Promise.all([
      this.searchTickets(user, perms, query),
      this.searchProjects(user, perms, query),
      // People search is only meaningful for roles that see more than their
      // own team's tickets — field-team/client scopes don't get an org
      // directory (matches the existing assignee-picker gate in
      // CreateTicketModal.tsx, which is scope: 'all' only).
      perms.scope === 'all' || perms.scope === 'team' ? this.searchPeople(query) : Promise.resolve([]),
    ]);

    return { tickets, projects, people };
  }

  private searchTickets(user: AuthenticatedUser, perms: RolePermissions, query: string) {
    return this.prisma.ticket.findMany({
      where: {
        AND: [
          ticketVisibilityWhere(user, perms),
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { displayId: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, displayId: true, title: true, status: true },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  private searchProjects(user: AuthenticatedUser, perms: RolePermissions, query: string) {
    const scopeWhere: Prisma.ProjectWhereInput =
      perms.scope === 'team' ? { teamId: { in: user.ledTeamIds } } : {};

    return this.prisma.project.findMany({
      where: {
        AND: [
          scopeWhere,
          { OR: [{ name: { contains: query, mode: 'insensitive' } }, { code: { contains: query, mode: 'insensitive' } }] },
        ],
      },
      select: { code: true, name: true },
      take: RESULT_LIMIT,
      orderBy: { name: 'asc' },
    });
  }

  private searchPeople(query: string) {
    return this.prisma.user.findMany({
      where: {
        OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }],
      },
      select: SAFE_USER_SELECT,
      take: RESULT_LIMIT,
      orderBy: { name: 'asc' },
    });
  }
}
