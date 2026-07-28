import { IsBoolean, IsIn } from 'class-validator';
import { RolePermissions, Scope, WorkHoursVisibility } from '../../common/permissions/role-permissions';

const SCOPES: Scope[] = ['all', 'team', 'source', 'reporter'];
const WORK_HOURS_VISIBILITIES: WorkHoursVisibility[] = ['none', 'own', 'team', 'org'];

// Full permissions payload for POST /roles and PATCH /roles/:id/permissions
// — mirrors RolePermissions (role-permissions.ts) field-for-field so an
// admin edit always writes a complete, valid object into permissionsJson
// (no partial/sparse updates that could leave a role in an inconsistent
// state).
export class RolePermissionsDto implements RolePermissions {
  @IsIn(SCOPES)
  scope: Scope;

  @IsBoolean()
  dashboard: boolean;

  @IsBoolean()
  projects: boolean;

  @IsBoolean()
  board: boolean;

  @IsBoolean()
  comms: boolean;

  @IsBoolean()
  createProject: boolean;

  @IsBoolean()
  userManagement: boolean;

  @IsBoolean()
  manageLabels: boolean;

  @IsBoolean()
  manageSLA: boolean;

  @IsBoolean()
  manageAI: boolean;

  @IsBoolean()
  adminAnalytics: boolean;

  @IsBoolean()
  simpleDashboard: boolean;

  @IsBoolean()
  canReopen: boolean;

  @IsBoolean()
  timeTracking: boolean;

  @IsBoolean()
  restrictedStatuses: boolean;

  @IsIn(WORK_HOURS_VISIBILITIES)
  workHoursVisibility: WorkHoursVisibility;

  @IsBoolean()
  manageRoles: boolean;
}
