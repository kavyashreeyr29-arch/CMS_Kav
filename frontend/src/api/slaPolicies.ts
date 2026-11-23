import { api } from './client';

export interface SlaPolicyRow {
  id: string;
  priority: string | null;
  projectId: string | null;
  clientName: string | null;
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
  documentFileName: string | null;
  documentFileSize: number | null;
}

export interface BulkUploadRowResult {
  row: number;
  input: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

export interface BulkUploadResult {
  preview: boolean;
  total: number;
  validCount?: number;
  committed?: number;
  results: BulkUploadRowResult[];
}

export const slaPoliciesApi = {
  list: () => api.get<SlaPolicyRow[]>('/sla-policies'),
  create: (body: Record<string, unknown>) => api.post<SlaPolicyRow>('/sla-policies', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<SlaPolicyRow>(`/sla-policies/${id}`, body),
  remove: (id: string) => api.delete(`/sla-policies/${id}`),
  bulkUpload: (rows: Record<string, unknown>[], commit: boolean) =>
    api.post<BulkUploadResult>('/sla-policies/bulk-upload', { rows, commit }),
  requestDocumentUploadUrl: (id: string, fileName: string) =>
    api.get<{ uploadUrl: string; storageKey: string }>(`/sla-policies/${id}/document/upload-url`, { fileName }),
  attachDocument: (id: string, doc: { fileName: string; fileSize: number; mimeKind: string; storageKey: string }) =>
    api.post<SlaPolicyRow>(`/sla-policies/${id}/document`, doc),
  getDocumentDownloadUrl: (id: string) => api.get<{ downloadUrl: string }>(`/sla-policies/${id}/document/download-url`),
};
