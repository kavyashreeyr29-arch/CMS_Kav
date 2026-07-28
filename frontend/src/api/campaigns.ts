import { api } from './client';
import { UserSummary } from '../types/ticket';

export type CampaignStatus = 'Planned' | 'Active' | 'Completed';

export interface CampaignRow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdByUserId: string;
  createdAt: string;
  createdBy: UserSummary;
  _count: { tickets: number; documents: number };
}

export interface CampaignTicketSummaryRow {
  ticketId: string;
  createdAt: string;
  campaignId: string;
  campaignName: string;
  projectCode: string;
}

export const campaignsApi = {
  listForProject: (projectCode: string) => api.get<CampaignRow[]>(`/campaigns?projectCode=${projectCode}`),
  summary: () => api.get<CampaignTicketSummaryRow[]>('/campaigns/summary'),
  create: (body: { projectCode: string; name: string; description?: string; status?: CampaignStatus; startDate?: string; endDate?: string }) =>
    api.post<CampaignRow>('/campaigns', body),
  update: (id: string, body: Partial<{ name: string; description: string; status: CampaignStatus; startDate: string; endDate: string }>) =>
    api.patch<CampaignRow>(`/campaigns/${id}`, body),
};
