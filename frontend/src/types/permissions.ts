// Mirrors backend/src/common/permissions/role-permissions.ts — keep in sync.
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
  manageRoles: boolean;
  manageWorkflow: boolean;
}

export interface RoleSummary {
  id: string;
  label: string;
  group: 'Full access' | 'Field team' | 'External';
}
