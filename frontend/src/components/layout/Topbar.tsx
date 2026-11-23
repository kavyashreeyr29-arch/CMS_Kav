import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, Plus, Shield } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { NotificationBell } from './NotificationBell';
import { RoleMatrixModal } from './RoleMatrixModal';
import { SearchBox } from './SearchBox';
import { NAV_ITEMS } from './navConfig';
import { ticketScopeLabel } from '../../permissions/helpers';
import { RolePermissions } from '../../types/permissions';
import { Project } from '../../types/project';

function initialsOf(name: string): string {
  return name.split(' ').map((s) => s[0]).join('').replace('.', '').slice(0, 2).toUpperCase();
}

// The sidebar owns the brand identity now (logo + "ElevatoHub"), so the
// topbar shows "where am I" instead — matched against the same NAV_ITEMS
// the sidebar renders from, so it never drifts out of sync with the nav.
function pageTitleFor(pathname: string, permissions: RolePermissions | null): string {
  if (!permissions) return '';
  const match = NAV_ITEMS.filter((item) => pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!match) return '';
  return match.path === '/tickets' ? ticketScopeLabel(permissions) : match.label;
}

interface Props {
  onNewTicket?: () => void;
  onMenuClick?: () => void;
  projects: Project[];
  projectFilter: string;
  onProjectFilterChange: (code: string) => void;
}

export function Topbar({ onNewTicket, onMenuClick, projects, projectFilter, onProjectFilterChange }: Props) {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="topbar">
      <button className="menu-btn" onClick={onMenuClick} aria-label="Open menu"><Menu size={20} /></button>
      <div className="titles">
        <h1>{pageTitleFor(location.pathname, permissions)}</h1>
      </div>
      <SearchBox />
      <div className="topbar-right">
        {projects.length > 0 && (
          <div className="select-pill proj-select-wrap">
            <select className="proj-select" value={projectFilter} onChange={(e) => onProjectFilterChange(e.target.value)}>
              <option value="ALL">All projects</option>
              {projects.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
            </select>
            <ChevronDown size={13} className="proj-select-chevron" />
          </div>
        )}
        {onNewTicket && (
          <button className="btn-primary" onClick={onNewTicket} aria-label="New ticket">
            <Plus size={14} />
            <span className="btn-label">New ticket</span>
          </button>
        )}
        <NotificationBell />
        {permissions?.dashboard && (
          <button className="icon-btn" title="View role & permission matrix" aria-label="View role & permission matrix" onClick={() => setShowRoleMatrix(true)}>
            <Shield size={16} />
          </button>
        )}
        <div className="bell-wrap">
          <button className="role-switcher" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" aria-expanded={menuOpen}>
            <div className="avatar">{user ? initialsOf(user.name) : '?'}</div>
            <div className="role-switcher-text">
              <div className="role-switcher-name">{user?.name}</div>
              <div className="role-switcher-group">{user?.role.label}</div>
            </div>
            <ChevronDown size={13} />
          </button>
          {menuOpen && (
            <div className="bell-dropdown" style={{ width: 200 }}>
              <button className="bell-item" onClick={handleLogout} style={{ cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none', background: 'none', font: 'inherit', color: 'inherit' }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      {showRoleMatrix && <RoleMatrixModal onClose={() => setShowRoleMatrix(false)} />}
    </div>
  );
}
