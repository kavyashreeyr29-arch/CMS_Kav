import { api } from './client';
import { LoginResponse, CurrentUser } from '../types/auth';
import { RolePermissions } from '../types/permissions';

export const authApi = {
  login: (email: string, password: string) => api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<{ user: CurrentUser; permissions: RolePermissions }>('/auth/me'),
};
