import { RolePermissions } from '../types/permissions';

/** Mirrors landingTabFor() in the reference prototype. */
export function landingPathFor(perms: RolePermissions): string {
  if (perms.dashboard) return '/dashboard';
  if (perms.simpleDashboard) return '/my-board';
  return '/tickets';
}

export function ticketScopeLabel(perms: RolePermissions): string {
  if (perms.scope === 'all') return 'Tickets';
  // 'team' (Lead/Manager seniority) and 'source' (field teams) both see a
  // group's tickets, not just their own — only 'reporter' (Client) means
  // "mine". These used to share a fallback, which mislabeled a Lead's view
  // as "My tickets" (found via a full role-permission sweep, see CHANGELOG).
  if (perms.scope === 'source' || perms.scope === 'team') return 'Team tickets';
  return 'My tickets';
}
