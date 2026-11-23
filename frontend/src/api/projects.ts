import { api } from './client';
import { Project } from '../types/project';

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (code: string) => api.get<Project>(`/projects/${code}`),
  create: (body: Record<string, unknown>) => api.post<Project>('/projects', body),
  update: (code: string, body: Record<string, unknown>) => api.patch<Project>(`/projects/${code}`, body),
  remove: (code: string) => api.delete(`/projects/${code}`),
  requestDocumentUploadUrl: (code: string, fileName: string) =>
    api.get<{ uploadUrl: string; storageKey: string }>(`/projects/${code}/documents/upload-url`, { fileName }),
  addDocument: (code: string, doc: { fileName: string; fileSize: number; mimeKind: string; storageKey: string; section?: string; campaignId?: string; rewardId?: string }) =>
    api.post(`/projects/${code}/documents`, doc),
  getDocumentDownloadUrl: (code: string, documentId: string) =>
    api.get<{ downloadUrl: string }>(`/projects/${code}/documents/${documentId}/download-url`),
  addMember: (code: string, userId: string) => api.post<Project>(`/projects/${code}/members`, { userId }),
  removeMember: (code: string, userId: string) => api.delete<Project>(`/projects/${code}/members/${userId}`),
};
