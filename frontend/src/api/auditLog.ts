import { api } from './client';

export interface AuditLogChange {
  before: unknown;
  after: unknown;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  changes: Record<string, AuditLogChange> | null;
  createdAt: string;
  actor: { name: string; email: string };
}

export interface AuditLogPage {
  data: AuditLogEntry[];
  total: number;
}

export const auditLogApi = {
  list: (params: { limit?: number; offset?: number; action?: string; targetType?: string }) =>
    api.get<AuditLogPage>('/audit-log', params),
};
