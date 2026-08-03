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

export const timesheetApi = {
  listMine: (params: { startDate: string; endDate?: string }) => api.get<TimesheetEntry[]>('/time-entries/mine', params),
  createManual: (body: CreateManualTimeEntryInput) => api.post<TimesheetEntry>('/time-entries', body),
  deleteManual: (id: string) => api.delete<{ id: string }>(`/time-entries/${id}`),
};
