import { api } from './client';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  baseRoleId: string;
  seniority: string | null;
  status: 'active' | 'disabled';
  baseRole: { id: string; label: string; group: string };
}

export const usersApi = {
  list: () => api.get<UserRow[]>('/users'),
  create: (body: { name: string; email: string; password: string; baseRoleId: string; seniority?: string }) =>
    api.post<UserRow>('/users', body),
  update: (id: string, body: Partial<{ name: string; email: string; baseRoleId: string; seniority: string }>) =>
    api.patch<UserRow>(`/users/${id}`, body),
  remove: (id: string) => api.delete(`/users/${id}`),
};
