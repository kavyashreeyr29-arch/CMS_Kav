import { permissionsFor, RolePermissions } from './role-permissions';

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  baseRoleId: string;
  seniority: string | null;
  ledTeamIds: string[];
}

/**
 * LLD §3.4 — Lead/Manager seniority inherits Director-shaped dashboard access
 * but scoped to the team(s) they lead, rather than portfolio-wide, unless
 * their *base* role already grants org-wide access (Admin/Director/PM).
 */
export function effectivePermissions(user: AuthenticatedUser): RolePermissions {
  const base = permissionsFor(user.baseRoleId);
  const isOrgWideBaseRole = ['admin', 'director', 'pm'].includes(user.baseRoleId);

  if (!isOrgWideBaseRole && (user.seniority === 'lead' || user.seniority === 'manager')) {
    // Widened alongside Director/PM (see ROLE_PERMISSIONS) — Leads/Managers
    // now get Analytics too, scoped to their own team by
    // AnalyticsService.projectWise()'s teamId filter (same pattern
    // ProjectsService.findAll() already uses for 'team' scope).
    return { ...base, scope: 'team', dashboard: true, adminAnalytics: true, workHoursVisibility: 'team' };
  }

  return base;
}
