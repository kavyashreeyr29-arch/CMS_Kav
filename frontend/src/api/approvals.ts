import { api } from './client';
import { ApprovalRequest } from '../types/ticket';

export interface CreateApprovalRequestInput {
  ticketId: string;
  label: string;
  approverUserId?: string;
  approverRoleId?: string;
  requestNote?: string;
}

export interface DecideApprovalInput {
  decision: 'approved' | 'rejected' | 'changes_requested';
  comment?: string;
}

export const approvalsApi = {
  listForTicket: (ticketId: string) => api.get<ApprovalRequest[]>('/approvals', { ticketId }),
  create: (body: CreateApprovalRequestInput) => api.post<ApprovalRequest>('/approvals', body),
  decide: (id: string, body: DecideApprovalInput) => api.patch<ApprovalRequest>(`/approvals/${id}/decide`, body),
};
