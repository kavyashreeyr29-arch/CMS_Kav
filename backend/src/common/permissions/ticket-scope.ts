import { Prisma, TicketType } from '@prisma/client';
import { AuthenticatedUser } from './effective-permissions';
import { RolePermissions, SOURCE_BY_ROLE, RoleId } from './role-permissions';

/**
 * LLD §3.2 — server-side query filter. This is injected into every ticket
 * read path (list, dashboard aggregates, analytics, export) at the
 * query-builder level so there is no code path that can leak out-of-scope
 * tickets. Never filter client-side or in application code after the fact.
 */
export function ticketVisibilityWhere(
  user: AuthenticatedUser,
  perms: RolePermissions,
): Prisma.TicketWhereInput {
  switch (perms.scope) {
    case 'all':
      return {};
    case 'team':
      // A ticket homed in another team's project is still visible if this
      // Lead/Manager's team is tagged as a collaborator on it (e.g. a
      // call-center-raised issue that needs both Tech and Ops) — see
      // Ticket.collaboratingTeamIds.
      return {
        OR: [
          { project: { teamId: { in: user.ledTeamIds } } },
          { collaboratingTeamIds: { hasSome: user.ledTeamIds } },
        ],
      };
    case 'source': {
      const source = SOURCE_BY_ROLE[user.baseRoleId as RoleId];
      return source ? { source: source as never } : { id: { equals: '__none__' } };
    }
    case 'reporter':
      return { reporterUserId: user.id };
  }
}

const DEPARTMENT_BY_TYPE: Record<TicketType, string> = {
  Story: 'Engineering Team',
  Epic: 'Engineering Team',
  Bug: 'Engineering Team',
  Feature: 'Engineering Team',
  Enhancement: 'Engineering Team',
  Task: 'Delivery Team',
  ChangeRequest: 'Delivery Team',
  Support: 'Support Team',
};

interface TicketWithAssignee {
  type: TicketType;
  assigneeUserId: string | null;
  assignee?: { id: string; name: string } | null;
  [key: string]: unknown;
}

/**
 * LLD §3.3 — assignee redaction cannot be "don't send the field"; the UI
 * still needs something to display. Compute the redacted view server-side so
 * the raw assignee identity never reaches a `reporter`-scoped client at all —
 * not even visible via devtools/network inspection.
 */
export function serializeTicketForViewer<T extends TicketWithAssignee>(
  ticket: T,
  perms: RolePermissions,
): Omit<T, 'assignee' | 'assigneeUserId'> & { assigneeDisplay: string | null; assigneeId: string | null } {
  const { assignee, assigneeUserId, ...rest } = ticket;

  if (perms.scope === 'reporter') {
    return {
      ...rest,
      assigneeDisplay: DEPARTMENT_BY_TYPE[ticket.type] ?? 'Delivery Team',
      assigneeId: null,
    } as never;
  }

  return {
    ...rest,
    assigneeDisplay: assignee?.name ?? null,
    assigneeId: assigneeUserId,
  } as never;
}
