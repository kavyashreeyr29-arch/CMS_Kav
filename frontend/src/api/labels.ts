import { api } from './client';

export interface LabelRow {
  id: string;
  name: string;
  active: boolean;
  _count: { tickets: number };
}

export const labelsApi = {
  list: () => api.get<LabelRow[]>('/labels'),
  create: (name: string) => api.post<LabelRow>('/labels', { name }),
  remove: (id: string) => api.delete(`/labels/${id}`),
};
