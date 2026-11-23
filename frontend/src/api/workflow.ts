import { api } from './client';
import { TicketStatus } from '../types/ticket';

export interface WorkflowTransitionRow {
  id: string;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  requiresAssignee: boolean;
  requiresLinkedPr: boolean;
  requiresApprovedPr: boolean;
  requiresMergedPr: boolean;
  requiresQaPass: boolean;
  requiresApproval: boolean;
  approvalLabel: string | null;
  allowedRoleIds: string[];
}

export type WorkflowTransitionInput = Omit<WorkflowTransitionRow, 'id'>;

export const WORKFLOW_STATUSES: TicketStatus[] = [
  'RequirementGathering', 'CommercialApproval', 'RequirementApproval', 'ManagerApproval',
  'Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Completed', 'Closed', 'Reopened',
];

export const workflowApi = {
  list: () => api.get<WorkflowTransitionRow[]>('/workflow'),
  replace: (transitions: WorkflowTransitionInput[]) =>
    api.put<WorkflowTransitionRow[]>('/workflow', { transitions }),
};
