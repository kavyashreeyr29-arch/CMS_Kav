import { api } from './client';
import { UserSummary } from '../types/ticket';

export interface ProjectTodoRow {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
  assigneeUserId: string | null;
  assignee: UserSummary | null;
  dueDate: string | null;
  createdByUserId: string;
  createdBy: UserSummary;
  createdAt: string;
  completedAt: string | null;
}

export const projectTodosApi = {
  listForProject: (projectCode: string) => api.get<ProjectTodoRow[]>(`/project-todos?projectCode=${projectCode}`),
  create: (body: { projectCode: string; title: string; assigneeUserId?: string; dueDate?: string }) =>
    api.post<ProjectTodoRow>('/project-todos', body),
  update: (id: string, body: Partial<{ title: string; done: boolean; assigneeUserId: string; dueDate: string }>) =>
    api.patch<ProjectTodoRow>(`/project-todos/${id}`, body),
  remove: (id: string) => api.delete<{ id: string }>(`/project-todos/${id}`),
};
