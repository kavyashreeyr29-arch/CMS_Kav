import { api } from './client';

export type TimeEntrySource = 'timer' | 'manual';

export interface TimesheetEntry {
  id: string;
  ticketId: string | null;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: string | number | null;
  source: TimeEntrySource;
  taskName: string | null;
  ticket: { id: string; displayId: string; title: string } | null;
}

export interface CreateManualTimeEntryInput {
  date: string; // YYYY-MM-DD
  fromTime: string; // HH:mm
  toTime: string; // HH:mm
  taskName: string;
  ticketId?: string;
}

export interface TeamTimesheetSummaryRow {
  user_id: string;
  name: string;
  seniority: string | null;
  automated_minutes: number;
  manual_minutes: number;
  tickets_touched: number;
}

export const timesheetApi = {
  // userId lets an org/team-visibility viewer drill into someone else's
  // entries; omitted (or your own id) always means "my own".
  listMine: (params: { startDate: string; endDate?: string; userId?: string }) => api.get<TimesheetEntry[]>('/time-entries/mine', params),
  teamSummary: (params: { startDate: string; endDate?: string; team?: string; userId?: string }) =>
    api.get<TeamTimesheetSummaryRow[]>('/time-entries/team-summary', params),
  createManual: (body: CreateManualTimeEntryInput) => api.post<TimesheetEntry>('/time-entries', body),
  deleteManual: (id: string) => api.delete<{ id: string }>(`/time-entries/${id}`),
};
