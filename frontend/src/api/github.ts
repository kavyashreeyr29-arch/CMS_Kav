import { api } from './client';
import { TicketStatus } from '../types/ticket';

export interface GithubConfig {
  repoOwner: string;
  repoName: string;
  autoTransition: boolean;
  onPrOpenedStatus: TicketStatus | null;
  onPrApprovedStatus: TicketStatus | null;
  onPrMergedStatus: TicketStatus | null;
  hasToken: boolean;
  webhookConfigured: boolean;
  connectedAt: string;
}

export interface GithubConfigInput {
  repoOwner: string;
  repoName: string;
  token?: string;
  webhookSecret?: string;
  autoTransition: boolean;
  onPrOpenedStatus?: TicketStatus | null;
  onPrApprovedStatus?: TicketStatus | null;
  onPrMergedStatus?: TicketStatus | null;
}

// webhookSecret comes back only once, on save — so the admin can paste it into
// GitHub. It's never returned by getConfig().
export interface GithubConfigSaved extends GithubConfig {
  webhookSecret: string;
}

export const githubApi = {
  getConfig: () => api.get<GithubConfig | null>('/github/integration'),
  save: (body: GithubConfigInput) => api.put<GithubConfigSaved>('/github/integration', body),
  remove: () => api.delete<{ ok: boolean }>('/github/integration'),
  unlinkPr: (id: string) => api.delete<{ id: string }>(`/github/pull-requests/${id}`),
};
