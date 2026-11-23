import { api } from './client';
import { RolePermissions } from '../types/permissions';

export interface RoleMatrixRow {
  id: string;
  label: string;
  group: string;
  permissions: RolePermissions;
}

export interface CreateRolePayload {
  id: string;
  label: string;
  group: string;
  permissions: RolePermissions;
  source?: string;
}

export const rolesApi = {
  list: () => api.get<{ id: string; label: string; group: string }[]>('/roles'),
  permissionMatrix: () => api.get<RoleMatrixRow[]>('/roles/permission-matrix'),
  create: (payload: CreateRolePayload) => api.post<RoleMatrixRow>('/roles', payload),
  updatePermissions: (id: string, permissions: RolePermissions, source?: string) =>
    api.patch(`/roles/${id}/permissions`, { permissions, source }),
};
