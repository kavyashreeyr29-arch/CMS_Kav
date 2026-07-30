import { MimeKind, UserSummary } from './ticket';

// Real SDLC phases, not just Active/Planning/OnHold/Completed — see
// CHANGELOG.md. Mirrors backend/prisma/schema.prisma's ProjectStatus.
export type ProjectStatus =
  | 'Planning' | 'RequirementAnalysis' | 'Design' | 'Implementation'
  | 'Testing' | 'Deployment' | 'Maintenance' | 'OnHold' | 'Completed';
// In lifecycle order — shared by the create and edit forms.
export const PROJECT_STATUSES: ProjectStatus[] = [
  'Planning', 'RequirementAnalysis', 'Design', 'Implementation',
  'Testing', 'Deployment', 'Maintenance', 'OnHold', 'Completed',
];
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeKind: MimeKind;
  storageKey: string;
  createdAt: string;
  section: 'campaign' | 'communication' | 'reward' | 'todo' | 'commercial' | null;
  campaignId: string | null;
  rewardId: string | null;
}

export interface ProjectMember {
  id: string;
  userId: string;
  user?: UserSummary;
  addedAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  pmUserId: string;
  pm?: UserSummary;
  teamId: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  endDate: string;
  description: string | null;
  documents: ProjectDocument[];
  members?: ProjectMember[];
  memberCount?: number;
  _count?: { tickets: number };
  openCount?: number;
  overdueCount?: number;
  createdAt: string;
  updatedAt: string;
}
