// Central permission model — LLD §3.1 / §3.3.
// This is the single source of truth for what each role can do; every guard,
// controller, and service-layer scope filter reads from here. Keep this in
// sync with docs/prd.md §3 and the reference prototype's ROLE_PERMISSIONS.
//
// Dynamic RBAC (CHANGELOG.md "admin-configurable roles"): permissionsFor()
// must stay synchronous — it's called from PermissionsGuard.canActivate(),
// which is itself synchronous, on every permission-gated request. Rather
// than hit Prisma on every call, the 12 built-in defaults below seed an
// in-memory cache at module load; RolesService (roles/roles.service.ts)
// overwrites cache entries at boot from any role's `permissionsJson` column,
// and again immediately on every create/update — so admin changes take
// effect without a restart, without making this hot path async.

export type Scope = 'all' | 'team' | 'source' | 'reporter';
export type WorkHoursVisibility = 'none' | 'own' | 'team' | 'org';

export interface RolePermissions {
  scope: Scope;
  dashboard: boolean;
  projects: boolean;
  board: boolean;
  comms: boolean;
  createProject: boolean;
  userManagement: boolean;
  manageLabels: boolean;
  manageSLA: boolean;
  manageAI: boolean;
  adminAnalytics: boolean;
  simpleDashboard: boolean;
  canReopen: boolean;
  timeTracking: boolean;
  restrictedStatuses: boolean;
  workHoursVisibility: WorkHoursVisibility;
  // Admin-only capability gate for the Roles & Permissions admin screen
  // itself (create roles, edit any role's permissions) — true only for the
  // built-in `admin` role by default; not currently grantable to a custom
  // role via the UI, so a custom role can't self-escalate.
  manageRoles: boolean;
  // Gates the Workflow admin screen (configure status-transition gates) and
  // the GitHub integration admin screen. Both are org-process configuration,
  // so they share one capability rather than proliferating two flags.
  manageWorkflow: boolean;
}

// The 12 built-in roles every environment seeds (prisma/seed.ts ROLE_SEED).
// Still used as a compile-time convenience type in a few places (DTOs that
// want IDE autocomplete for the well-known roles) — NOT used any more to
// reject role ids at the validation layer, since custom roles are dynamic
// strings not known at compile time. See CreateUserDto.baseRoleId.
export const ROLE_IDS = [
  'admin',
  'director',
  'pm',
  'lead',
  'senior_developer',
  'junior_developer',
  'intern',
  'qa',
  'callcenter',
  'customersuccess',
  'operations',
  'client',
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export const ROLE_PERMISSIONS: Record<RoleId, RolePermissions> = {
  admin: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: true, manageLabels: true, manageSLA: true, manageAI: true, adminAnalytics: true,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'org',
    manageRoles: true, manageWorkflow: true,
  },
  director: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: true,
    simpleDashboard: false, canReopen: true, timeTracking: false, restrictedStatuses: false, workHoursVisibility: 'org',
    manageRoles: false, manageWorkflow: false,
  },
  pm: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: true,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'org',
    manageRoles: false, manageWorkflow: false,
  },
  // Lead/Manager seniority overrides `scope` to "team" at runtime — see effectivePermissions().
  lead: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'team',
    manageRoles: false, manageWorkflow: false,
  },
  senior_developer: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'own',
    manageRoles: false, manageWorkflow: false,
  },
  junior_developer: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'own',
    manageRoles: false, manageWorkflow: false,
  },
  intern: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'own',
    manageRoles: false, manageWorkflow: false,
  },
  qa: {
    scope: 'all', dashboard: true, projects: true, board: true, comms: true, createProject: true,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: false, canReopen: true, timeTracking: true, restrictedStatuses: false, workHoursVisibility: 'own',
    manageRoles: false, manageWorkflow: false,
  },
  callcenter: {
    scope: 'source', dashboard: false, projects: true, board: false, comms: false, createProject: false,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: true, canReopen: false, timeTracking: false, restrictedStatuses: true, workHoursVisibility: 'none',
    manageRoles: false, manageWorkflow: false,
  },
  customersuccess: {
    scope: 'source', dashboard: false, projects: true, board: true, comms: false, createProject: false,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false,
    // Widened from false — CHANGELOG.md "campaign summary should be visible
    // to... customer success" needs the Analytics page reachable at all
    // (its nav item is gated on this flag); Customer Success gets the same
    // full Analytics view Director/PM/Lead already have, not a stripped one,
    // matching this codebase's existing pattern of widening adminAnalytics
    // per-role rather than building a second narrower gate.
    adminAnalytics: true,
    simpleDashboard: true, canReopen: false, timeTracking: false, restrictedStatuses: false, workHoursVisibility: 'none',
    manageRoles: false, manageWorkflow: false,
  },
  operations: {
    scope: 'source', dashboard: false, projects: false, board: false, comms: false, createProject: false,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: true, canReopen: false, timeTracking: false, restrictedStatuses: true, workHoursVisibility: 'none',
    manageRoles: false, manageWorkflow: false,
  },
  client: {
    scope: 'reporter', dashboard: false, projects: false, board: false, comms: false, createProject: false,
    userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
    simpleDashboard: false, canReopen: true, timeTracking: false, restrictedStatuses: true, workHoursVisibility: 'none',
    manageRoles: false, manageWorkflow: false,
  },
};

// Safe all-locked-down baseline — every capability off, narrowest scope.
// Used to backfill a stored permissionsJson that predates a newly-added
// permission field (see withPermissionDefaults), so adding a field to
// RolePermissions can never leave an existing role's cached/returned object
// missing a key (which would 400 the update DTO). A new capability defaults
// to OFF for a role that was configured before it existed — the safe choice.
export const BASELINE_PERMISSIONS: RolePermissions = {
  scope: 'reporter', dashboard: false, projects: false, board: false, comms: false, createProject: false,
  userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
  simpleDashboard: false, canReopen: false, timeTracking: false, restrictedStatuses: false,
  workHoursVisibility: 'none', manageRoles: false, manageWorkflow: false,
};

/**
 * Merge a stored (possibly stale) permissions object over a complete default
 * so the result always has every RolePermissions key. Built-in roles merge
 * over their hardcoded default; custom roles over the locked-down baseline.
 */
export function withPermissionDefaults(roleId: string, stored: Partial<RolePermissions>): RolePermissions {
  const base = (ROLE_PERMISSIONS as Record<string, RolePermissions>)[roleId] ?? BASELINE_PERMISSIONS;
  return { ...base, ...stored };
}

const permissionsCache = new Map<string, RolePermissions>(Object.entries(ROLE_PERMISSIONS));

export function permissionsFor(roleId: string): RolePermissions {
  const perms = permissionsCache.get(roleId);
  if (!perms) {
    throw new Error(`Unknown role id: ${roleId}`);
  }
  return perms;
}

/** RolesService calls this at boot (from DB) and on every create/update — the one write path into the cache. */
export function setRolePermissions(roleId: string, perms: RolePermissions): void {
  permissionsCache.set(roleId, perms);
}

/** Existence check for role assignment (CreateUserDto/UsersService) without throwing. */
export function roleExists(roleId: string): boolean {
  return permissionsCache.has(roleId);
}

/** Roles whose ticket `source` scoping applies (LLD §3.2 "source" scope). */
export const SOURCE_BY_ROLE: Record<string, string> = {
  callcenter: 'CallCenter',
  customersuccess: 'CustomerSuccess',
  operations: 'Operations',
  client: 'ClientPortal',
};

/** A custom role created with scope:'source' needs its own channel mapping — RolesService writes it here. */
export function setSourceForRole(roleId: string, source: string): void {
  SOURCE_BY_ROLE[roleId] = source;
}
