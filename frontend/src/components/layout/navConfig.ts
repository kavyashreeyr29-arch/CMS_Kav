import {
  LayoutDashboard, Gauge, Folder, Ticket as TicketIcon, Trello, Mail,
  BarChart3, UserCog, Tag, LucideIcon, ListTodo, Clock3, Shield, Bot, ShieldCheck, History, Users2,
  GitBranch, Github,
} from 'lucide-react';
import { RolePermissions } from '../../types/permissions';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  show: (perms: RolePermissions) => boolean;
}

// Mirrors the sidebar/tabs conditional rendering in the reference
// prototype's App component — one source of truth for both.
export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: (p) => p.dashboard },
  { path: '/my-board', label: 'My tickets summary', icon: Gauge, show: (p) => p.simpleDashboard },
  { path: '/projects', label: 'Projects', icon: Folder, show: (p) => p.projects },
  { path: '/tickets', label: 'Tickets', icon: TicketIcon, show: () => true },
  // prd.md §4.1 — visible to PM/Lead/Senior Dev/Junior Dev/QA/Admin/Director,
  // i.e. every role with full (non-source/reporter-scoped) ticket visibility.
  { path: '/backlog', label: 'Backlog', icon: ListTodo, show: (p) => p.scope === 'all' },
  { path: '/kanban', label: 'Board', icon: Trello, show: (p) => p.board },
  { path: '/comms', label: 'Comms & tracking', icon: Mail, show: (p) => p.comms },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, show: (p) => p.adminAnalytics },
  { path: '/work-hours', label: 'Team hours', icon: Clock3, show: (p) => p.workHoursVisibility !== 'none' },
  { path: '/users', label: 'Users & roles', icon: UserCog, show: (p) => p.userManagement },
  { path: '/teams', label: 'Teams', icon: Users2, show: (p) => p.userManagement },
  { path: '/roles', label: 'Roles & permissions', icon: ShieldCheck, show: (p) => p.manageRoles },
  { path: '/workflow', label: 'Workflow', icon: GitBranch, show: (p) => p.manageWorkflow },
  { path: '/github', label: 'GitHub integration', icon: Github, show: (p) => p.manageWorkflow },
  { path: '/audit-log', label: 'Audit log', icon: History, show: (p) => p.userManagement },
  { path: '/labels', label: 'Labels', icon: Tag, show: (p) => p.manageLabels },
  { path: '/business-categories', label: 'Business categories', icon: Tag, show: (p) => p.manageLabels },
  { path: '/sla-policies', label: 'SLA policies', icon: Shield, show: (p) => p.manageSLA },
  { path: '/ai-providers', label: 'AI integrations', icon: Bot, show: (p) => p.manageAI },
];
