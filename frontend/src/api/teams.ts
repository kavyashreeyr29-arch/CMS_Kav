import { api } from './client';
import { UserSummary } from '../types/ticket';

export interface TeamRow {
  id: string;
  name: string;
  leadUserId: string | null;
  lead: UserSummary | null;
  memberships: { userId: string; user: UserSummary }[];
  // Admin-configurable "team hours" access beyond this team's own Lead —
  // specific people and/or whole roles (backend/src/common/permissions/team-access.ts).
  hoursViewerUserIds: string[];
  hoursViewerRoleIds: string[];
}

export interface TeamWriteBody {
  name?: string;
  leadUserId?: string | null;
  memberUserIds?: string[];
  hoursViewerUserIds?: string[];
  hoursViewerRoleIds?: string[];
}

export const teamsApi = {
  list: () => api.get<TeamRow[]>('/teams'),
  get: (id: string) => api.get<TeamRow>(`/teams/${id}`),
  create: (body: TeamWriteBody & { name: string }) => api.post<TeamRow>('/teams', body),
  update: (id: string, body: TeamWriteBody) => api.patch<TeamRow>(`/teams/${id}`, body),
  remove: (id: string) => api.delete(`/teams/${id}`),
};
