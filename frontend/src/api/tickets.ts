import { api } from './client';
import { PaginatedTickets, Ticket, TicketComment, TicketAttachment, TimeEntry, ActivityEntry, FieldChange, TestCase } from '../types/ticket';

export interface TicketQuery {
  project?: string;
  status?: string;
  priority?: string;
  source?: string;
  label?: string;
  slaBreached?: string;
  type?: string;
  view?: 'mine' | 'all';
  page?: number;
  pageSize?: number;
}

export const ticketsApi = {
  list: (query: TicketQuery = {}) => api.get<PaginatedTickets>('/tickets', query as Record<string, string>),
  get: (id: string) => api.get<Ticket>(`/tickets/${id}`),
  history: (id: string) => api.get<ActivityEntry[]>(`/tickets/${id}/history`),
  create: (body: Record<string, unknown>) => api.post<Ticket>('/tickets', body),
  updateStatus: (id: string, status: string) => api.patch<Ticket>(`/tickets/${id}/status`, { status }),
  updateBacklogRank: (id: string, backlogRank: number) => api.patch<Ticket>(`/tickets/${id}/backlog-rank`, { backlogRank }),
  reopen: (id: string) => api.post<Ticket>(`/tickets/${id}/reopen`),
  linkCampaign: (id: string, campaignId: string | null) => api.patch<Ticket>(`/tickets/${id}/campaign`, { campaignId }),
  linkReward: (id: string, rewardId: string | null) => api.patch<Ticket>(`/tickets/${id}/reward`, { rewardId }),
  addComment: (id: string, body: string) => api.post<TicketComment>(`/tickets/${id}/comments`, { body }),
  requestAttachmentUploadUrl: (id: string, fileName: string) =>
    api.get<{ uploadUrl: string; storageKey: string }>(`/tickets/${id}/attachments/upload-url`, { fileName }),
  addAttachment: (id: string, attachment: { fileName: string; fileSize: number; mimeKind: string; storageKey: string; context?: string }) =>
    api.post<TicketAttachment>(`/tickets/${id}/attachments`, attachment),
  getAttachmentDownloadUrl: (id: string, attachmentId: string) =>
    api.get<{ downloadUrl: string }>(`/tickets/${id}/attachments/${attachmentId}/download-url`),
  addWatcher: (id: string, userId: string) => api.post<Ticket>(`/tickets/${id}/watchers`, { userId }),
  updateFields: (id: string, body: Partial<{ title: string; description: string; priority: string; labelId: string; dueDate: string; assigneeUserId: string; businessCategory: string }>) =>
    api.patch<Ticket>(`/tickets/${id}`, body),
  fieldChanges: (id: string) => api.get<FieldChange[]>(`/tickets/${id}/field-changes`),
  startTimer: (id: string) => api.post<TimeEntry>(`/tickets/${id}/timer/start`),
  stopTimer: (id: string) => api.post<TimeEntry>(`/tickets/${id}/timer/stop`),
  testCases: (id: string) => api.get<TestCase[]>(`/tickets/${id}/test-cases`),
  addTestCase: (id: string, body: { title: string; steps?: string; expectedResult?: string }) =>
    api.post<TestCase>(`/tickets/${id}/test-cases`, body),
  updateTestCase: (id: string, testCaseId: string, body: { status?: string; regressionFlag?: boolean }) =>
    api.patch<TestCase>(`/tickets/${id}/test-cases/${testCaseId}`, body),
  removeTestCase: (id: string, testCaseId: string) => api.delete(`/tickets/${id}/test-cases/${testCaseId}`),
};
