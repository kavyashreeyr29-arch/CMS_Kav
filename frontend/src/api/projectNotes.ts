import { api } from './client';
import { UserSummary } from '../types/ticket';

export interface ProjectNoteRow {
  id: string;
  projectId: string;
  authorUserId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

export const projectNotesApi = {
  listForProject: (projectCode: string) => api.get<ProjectNoteRow[]>(`/project-notes?projectCode=${projectCode}`),
  create: (body: { projectCode: string; body: string }) => api.post<ProjectNoteRow>('/project-notes', body),
  remove: (id: string) => api.delete<{ id: string }>(`/project-notes/${id}`),
};
