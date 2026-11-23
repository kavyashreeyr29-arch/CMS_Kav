import { PrismaService } from '../../prisma/prisma.service';

/**
 * Teams a user has explicit "team hours" visibility into, independent of
 * their role's own workHoursVisibility default — being the team's Lead,
 * individually granted (Team.hoursViewerUserIds), or granted by role
 * (Team.hoursViewerRoleIds). Lets an admin widen access for a role that
 * would otherwise only see its own hours (or none at all) to a specific
 * team, without changing what that role can do anywhere else.
 *
 * Plain function (not a service) so both AuthService (building the login/me
 * profile) and TimeEntriesService (the actual query-time gate) can call it
 * without a cross-module DI dependency — same reasoning as
 * ticketVisibilityWhere living as a standalone function rather than a
 * service method.
 */
export async function getGrantedTeamIds(
  prisma: PrismaService,
  user: { id: string; baseRoleId: string },
): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { leadUserId: user.id },
        { hoursViewerUserIds: { has: user.id } },
        { hoursViewerRoleIds: { has: user.baseRoleId } },
      ],
    },
    select: { id: true },
  });
  return teams.map((t) => t.id);
}
