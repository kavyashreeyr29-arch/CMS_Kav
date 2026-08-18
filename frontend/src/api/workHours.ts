import { api } from './client';

export interface WorkHoursRow {
  user_id: string;
  name: string;
  seniority: string | null;
  hours_today: number;
}

export interface WorkHoursEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: string | number | null;
  // A manual entry logged with no specific ticket (e.g. "daily standup")
  // has no ticket relation at all — null, not omitted.
  ticket: { id: string; displayId: string; title: string } | null;
}

export interface DailyWorkHoursRow {
  user_id: string;
  name: string;
  seniority: string | null;
  work_date: string;
  hours: number;
}

export const workHoursApi = {
  list: (params: { startDate?: string; endDate?: string; team?: string; userId?: string }) =>
    api.get<WorkHoursRow[]>('/reports/work-hours', params),
  daily: (params: { startDate?: string; endDate?: string; team?: string; userId?: string }) =>
    api.get<DailyWorkHoursRow[]>('/reports/work-hours/daily', params),
  drillDown: (userId: string, params: { startDate?: string; endDate?: string }) =>
    api.get<WorkHoursEntry[]>(`/reports/work-hours/${userId}/tickets`, params),
};
