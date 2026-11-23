import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { projectsApi } from '../../api/projects';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CreateTicketModal } from '../tickets/CreateTicketModal';
import { Project } from '../../types/project';

export interface ProjectFilterContext {
  projectFilter: string; // project code, or 'ALL'
  setProjectFilter: (code: string) => void;
}

export function AppShell() {
  const { user, permissions, loading } = useAuth();
  const location = useLocation();
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState('ALL');

  useEffect(() => {
    if (user) projectsApi.list().then(setProjects).catch(() => {});
  }, [user]);

  if (loading) return <div className="loading-state">Loading…</div>;
  if (!user || !permissions) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar permissions={permissions} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar
          onNewTicket={() => setShowCreateTicket(true)}
          onMenuClick={() => setSidebarOpen(true)}
          projects={projects}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
        />
        <div className="content" id="main-content" tabIndex={-1}>
          <div key={location.pathname} className="page-fade">
            <Outlet context={{ projectFilter, setProjectFilter } satisfies ProjectFilterContext} />
          </div>
        </div>
      </div>
      {showCreateTicket && (
        <CreateTicketModal
          defaultProjectCode={projectFilter !== 'ALL' ? projectFilter : undefined}
          onClose={() => setShowCreateTicket(false)}
          onCreated={() => setShowCreateTicket(false)}
        />
      )}
    </div>
  );
}
