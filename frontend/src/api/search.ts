import { api } from './client';
import { UserSummary } from '../types/ticket';

export interface SearchTicketResult {
  id: string;
  displayId: string;
  title: string;
  status: string;
}

export interface SearchProjectResult {
  code: string;
  name: string;
}

export interface SearchResults {
  tickets: SearchTicketResult[];
  projects: SearchProjectResult[];
  people: UserSummary[];
}

export const searchApi = {
  search: (q: string) => api.get<SearchResults>('/search', { q }),
};
