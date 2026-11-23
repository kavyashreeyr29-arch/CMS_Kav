import { api } from './client';

export interface ProjectWiseRow {
  projectCode: string;
  projectName: string;
  total: number;
  open: number;
  closed: number;
  avgAgeDays: number;
  hoursSpent: number;
  clientTotal: number;
  clientOpen: number;
  clientClosed: number;
}

export interface TrendResponse {
  period: 'month' | 'quarter' | 'year';
  projectCode: string;
  buckets: { period: string; created: number; closed: number }[];
}

export interface ProductivityResponse {
  sinceDays: number;
  totalHours: number;
  perDeveloper: { userId: string; name: string; hours: number; ticketCount: number }[];
  businessCategoryBreakdown: { category: string; hours: number; ticketCount: number }[];
}

export interface CycleTimeRow {
  status: string;
  avgHours: number;
  transitions: number;
}

export const analyticsApi = {
  projectWise: () => api.get<ProjectWiseRow[]>('/analytics/project-wise'),
  trend: (period: 'month' | 'quarter' | 'year', project?: string) =>
    api.get<TrendResponse>('/analytics/trend', { period, project }),
  productivity: (sinceDays?: number) => api.get<ProductivityResponse>('/analytics/productivity', sinceDays ? { sinceDays } : undefined),
  cycleTime: () => api.get<CycleTimeRow[]>('/analytics/cycle-time'),
};
