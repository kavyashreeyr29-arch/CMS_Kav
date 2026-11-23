import { api } from './client';
import { UserSummary } from '../types/ticket';

export interface RewardRow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  rewardType: string | null;
  value: string | null;
  createdByUserId: string;
  createdAt: string;
  createdBy: UserSummary;
  _count: { tickets: number; documents: number };
}

export const rewardsApi = {
  listForProject: (projectCode: string) => api.get<RewardRow[]>(`/rewards?projectCode=${projectCode}`),
  create: (body: { projectCode: string; name: string; description?: string; rewardType?: string; value?: number }) =>
    api.post<RewardRow>('/rewards', body),
  update: (id: string, body: Partial<{ name: string; description: string; rewardType: string; value: number }>) =>
    api.patch<RewardRow>(`/rewards/${id}`, body),
};
