import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Folder, Gauge, Megaphone, MessageSquare, Gift, ListChecks, Ticket as TicketIcon, Users as UsersIcon, X,
} from 'lucide-react';
import { projectsApi } from '../api/projects';
import { ticketsApi } from '../api/tickets';
import { usersApi, UserRow } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { PrioChip, PRIORITY_COLOR } from '../components/ui/Chips';
import { Project } from '../types/project';
import { Ticket } from '../types/ticket';
import { ProjectFilterContext } from '../components/layout/AppShell';
import { ProjectDocsTab } from '../components/projects/ProjectDocsTab';
import { ProjectCampaignsTab } from '../components/projects/ProjectCampaignsTab';
import { ProjectRewardsTab } from '../components/projects/ProjectRewardsTab';
import { ProjectCommunicationTab } from '../components/projects/ProjectCommunicationTab';
import { ProjectTodoTab } from '../components/projects/ProjectTodoTab';

const OPEN_STATUSES = ['RequirementGathering', 'CommercialApproval', 'RequirementApproval', 'ManagerApproval', 'Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Reopened'];

// Basecamp-style "folders" — Tickets isn't a persistent tab (see
// jumpToTickets below), it navigates straight to the real Tickets page
// pre-filtered to this project rather than duplicating that page's filters/
// export/columns inside a cramped tab.
type TabId = 'overview' | 'docs' | 'campaigns' | 'communication' | 'rewards' | 'todo';
const TABS: { id: TabId; label: string; icon: typeof Folder }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'docs', label: 'Docs & Files', icon: Folder },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'communication', label: 'Communication', icon: MessageSquare },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'todo', label: 'To-do list', icon: ListChecks },
];

export function ProjectDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setProjectFilter } = useOutletContext<ProjectFilterContext>();
  const [project, setProject] = useState<Project | null>(null);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [memberToAdd, setMemberToAdd] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('overview');

  function load() {
    if (!code) return;
    setLoading(true);
    Promise.all([projectsApi.get(code), ticketsApi.list({ project: code, pageSize: 200 })])
      .then(([p, t]) => {
        setProject(p);
        setAllTickets(t.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [code]);
  useEffect(() => { usersApi.list().then(setUsers).catch(() => {}); }, []);

  // Only the very first load blanks the page — background refreshes (after
  // linking a ticket, adding a member, uploading a file, etc.) update in
  // place instead, so a tab component's local state (e.g. which
  // campaign/reward is expanded) doesn't get wiped by a remount.
  if (loading && !project) return <div className="loading-state">Loading project…</div>;
  if (!project) return <div className="error-state">Project not found.</div>;

  const openCount = allTickets.filter((t) => OPEN_STATUSES.includes(t.status)).length;
  const overdueCount = allTickets.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && OPEN_STATUSES.includes(t.status),
  ).length;
  const recentTickets = allTickets.slice(0, 6);

  function viewInDashboard() {
    setProjectFilter(project!.code);
    navigate('/dashboard');
  }

  // "Total tickets" and the Tickets folder both jump to the real Tickets
  // page pre-filtered to this project — reuses its full filter/column/CSV
  // machinery instead of a second, cut-down ticket list living in a tab.
  function jumpToTickets() {
    setProjectFilter(project!.code);
    navigate('/tickets');
  }

  // docs/prd-phase2.md §11 — only Admin or this project's own PM manages its
  // access list; matches the server-side check in ProjectsService.addMember.
  const canManageAccess = !!user && (user.role.id === 'admin' || user.id === project.pmUserId);
  const memberIds = new Set((project.members ?? []).map((m) => m.userId));
  const memberCandidates = users.filter((u) => !memberIds.has(u.id));

  async function addMember() {
    if (!memberToAdd) return;
    await projectsApi.addMember(project!.code, memberToAdd);
    setMemberToAdd('');
    load();
  }

  async function removeMember(userId: string) {
    await projectsApi.removeMember(project!.code, userId);
    load();
  }

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="proj-code">{project.code}</span>
          <div className="modal-title">{project.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-ghost" onClick={viewInDashboard}><Gauge size={13} style={{ marginRight: 5 }} />View in dashboard</button>
          <button className="modal-close" onClick={() => navigate('/projects')} aria-label="Close"><X size={15} /></button>
        </div>
      </div>

      <div className="proj-tab-bar">
        {TABS.map((t) => (
          <div key={t.id} className={`period-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{t.label}
          </div>
        ))}
        <div className="period-btn" onClick={jumpToTickets}>
          <TicketIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Tickets →
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <div className="td-meta-grid">
            <div className="td-meta-item"><div className="td-meta-label">Client</div><div className="td-meta-value">{project.client}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Project manager</div><div className="td-meta-value">{project.pm?.name ?? '—'}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Status</div><div className="td-meta-value">{project.status}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">Priority</div><div className="td-meta-value"><PrioChip p={project.priority} /></div></div>
            <div className="td-meta-item"><div className="td-meta-label">Start</div><div className="td-meta-value mono">{new Date(project.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div></div>
            <div className="td-meta-item"><div className="td-meta-label">End</div><div className="td-meta-value mono">{new Date(project.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div></div>
          </div>

          {project.description && <div className="td-desc">{project.description}</div>}

          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div className="mom-stat proj-stat-actionable" style={{ flex: 1 }} onClick={jumpToTickets} title="Open all tickets for this project">
              <div className="mom-label">Total tickets</div><div className="mom-value">{allTickets.length}</div>
            </div>
            <div className="mom-stat proj-stat-actionable" style={{ flex: 1 }} onClick={jumpToTickets} title="Open all tickets for this project">
              <div className="mom-label">Open</div><div className="mom-value">{openCount}</div>
            </div>
            <div className="mom-stat proj-stat-actionable" style={{ flex: 1 }} onClick={jumpToTickets} title="Open all tickets for this project">
              <div className="mom-label">Overdue</div><div className="mom-value" style={{ color: overdueCount ? 'var(--critical)' : 'inherit' }}>{overdueCount}</div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div className="td-section-title"><UsersIcon size={13} />Access ({(project.members ?? []).length || 'everyone'})</div>
            <div style={{ marginBottom: 8 }}>
              {(project.members ?? []).length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                  No access list configured — open to everyone your role model already allows.
                </span>
              )}
              {(project.members ?? []).map((m) => (
                <span key={m.id} className="watcher-chip active">
                  {m.user?.name ?? m.userId}
                  {canManageAccess && (
                    <X size={11} style={{ marginLeft: 4, cursor: 'pointer' }} onClick={() => removeMember(m.userId)} />
                  )}
                </span>
              ))}
            </div>
            {canManageAccess && memberCandidates.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)} style={{ maxWidth: 220 }}>
                  <option value="">Add a member…</option>
                  {memberCandidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button className="btn-ghost" onClick={addMember} disabled={!memberToAdd}>Add</button>
              </div>
            )}
          </div>

          <div>
            <div className="td-section-title"><TicketIcon size={13} />Recent tickets</div>
            {recentTickets.map((t) => (
              <div key={t.id} className="timeline-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                <div className="timeline-dot" style={{ background: PRIORITY_COLOR[t.priority] }} />
                <div><span className="tid">{t.displayId}</span> {t.title} <span className="activity-time">· {t.status}</span></div>
              </div>
            ))}
            {recentTickets.length === 0 && <div className="empty-state">No tickets on this project yet.</div>}
          </div>
        </>
      )}

      {tab === 'docs' && <ProjectDocsTab project={project} onChange={load} />}
      {tab === 'campaigns' && <ProjectCampaignsTab project={project} tickets={allTickets} onChange={load} />}
      {tab === 'communication' && <ProjectCommunicationTab project={project} onChange={load} />}
      {tab === 'rewards' && <ProjectRewardsTab project={project} tickets={allTickets} onChange={load} />}
      {tab === 'todo' && <ProjectTodoTab project={project} users={users} onChange={load} />}
    </div>
  );
}
