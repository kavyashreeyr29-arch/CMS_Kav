import { api } from './client';
import { Notification } from '../types/notification';

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications'),
  markRead: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};
