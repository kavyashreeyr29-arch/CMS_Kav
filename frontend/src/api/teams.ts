import { api } from './client';
import { UserSummary } from '../types/ticket';

export interface TeamRow {
  id: string;
  name: string;
  leadUserId: string | null;
  lead: UserSummary | null;
  memberships: { userId: string; user: UserSummary }[];
}

export const teamsApi = {
  list: () => api.get<TeamRow[]>('/teams'),
  get: (id: string) => api.get<TeamRow>(`/teams/${id}`),
  create: (body: { name: string; leadUserId?: string; memberUserIds?: string[] }) =>
    api.post<TeamRow>('/teams', body),
  update: (id: string, body: { name?: string; leadUserId?: string | null; memberUserIds?: string[] }) =>
    api.patch<TeamRow>(`/teams/${id}`, body),
};
