import { SetMetadata } from '@nestjs/common';
import { RolePermissions } from '../permissions/role-permissions';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Marks a route as requiring a boolean capability from RolePermissions
 * (e.g. 'manageSLA', 'manageAI', 'userManagement'). Combine with
 * PermissionsGuard. Ticket-level scope filtering (LLD §3.2) is handled
 * separately in each service via ticketVisibilityWhere — this decorator is
 * only for the coarse "can this role reach this endpoint at all" check.
 */
export const RequirePermission = (permission: keyof RolePermissions) =>
  SetMetadata(PERMISSION_KEY, permission);
