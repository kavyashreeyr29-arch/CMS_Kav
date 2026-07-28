import { MimeKind, UserSummary } from './ticket';

export type ProjectStatus = 'Active' | 'Planning' | 'OnHold' | 'Completed';
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ProjectDocument {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  mimeKind: MimeKind;
  storageKey: string;
  createdAt: string;
  section: 'campaign' | 'communication' | 'reward' | 'todo' | null;
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
