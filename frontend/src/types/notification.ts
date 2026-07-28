export type NotificationType = 'assigned' | 'mentioned' | 'status' | 'attachment' | 'reopened' | 'project' | 'document' | 'watching';

export interface Notification {
  id: string;
  recipientUserId: string;
  ticketId: string | null;
  type: NotificationType;
  subject: string;
  body: string;
  channels: ('email' | 'teams')[];
  read: boolean;
  createdAt: string;
}
