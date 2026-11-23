import { api } from './client';

export interface BusinessCategoryRow {
  id: string;
  name: string;
  active: boolean;
}

export const businessCategoriesApi = {
  list: () => api.get<BusinessCategoryRow[]>('/business-categories'),
  create: (name: string) => api.post<BusinessCategoryRow>('/business-categories', { name }),
  remove: (id: string) => api.delete(`/business-categories/${id}`),
};
