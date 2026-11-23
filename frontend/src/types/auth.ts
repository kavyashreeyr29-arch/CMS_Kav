import { RolePermissions } from './permissions';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string | null;
  role: { id: string; label: string; group: string };
  seniority: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
  permissions: RolePermissions;
}
