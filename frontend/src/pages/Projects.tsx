import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Folder, Plus } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { useAuth } from '../auth/AuthContext';
import { PrioChip } from '../components/ui/Chips';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { Project } from '../types/project';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Active: { bg: '#E4F8F1', color: '#16946E' },
  Planning: { bg: '#E4F0FF', color: '#2563EB' },
  OnHold: { bg: '#FDF1DC', color: '#C87F0A' },
  Completed: { bg: 'var(--surface-2)', color: 'var(--ink-soft)' },
};

export function Projects() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    projectsApi.list().then(setProjects).finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <div className="loading-state">Loading projects…</div>;

  return (
    <>
      <div className="filter-bar">
        <div className="select-pill">{projects.length} projects</div>
        {permissions?.createProject && (
          <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>
            <Plus size={14} />New project
          </button>
        )}
      </div>
      <div className="proj-grid">
        {projects.map((p) => {
          const openCt = p.openCount ?? 0;
          const overdueCt = p.overdueCount ?? 0;
          const ratio = openCt ? overdueCt / openCt : 0;
          const health = ratio > 0.25 ? 'red' : ratio > 0.1 ? 'amber' : 'green';
          return (
          <Link className="proj-card" key={p.code} to={`/projects/${p.code}`}>
            <div className="proj-card-head">
              <span className="proj-code">{p.code}</span>
              <div className={`health-dot ${health}`} title={`${overdueCt} overdue of ${openCt} open`} />
            </div>
            <div className="proj-name">{p.name}</div>
            <div className="proj-client">{p.client} · PM: {p.pm?.name ?? '—'}</div>
            <span className="status-pill" style={STATUS_STYLE[p.status]}>{p.status}</span>{' '}
            <PrioChip p={p.priority} small />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ink-faint)', marginTop: 6 }}>
              <Folder size={11} />{p.documents.length} document{p.documents.length !== 1 ? 's' : ''} in folder
            </div>
            <div className="proj-meta-row">
              <div>{new Date(p.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – {new Date(p.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
              <div style={{ textAlign: 'right' }}>{p._count?.tickets ?? 0} tickets</div>
            </div>
          </Link>
          );
        })}
        {projects.length === 0 && <div className="empty-state">No projects yet.</div>}
      </div>
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(code) => { setShowCreate(false); navigate(`/projects/${code}`); }}
        />
      )}
    </>
  );
}
