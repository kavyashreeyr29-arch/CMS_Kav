import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { RolePermissions } from '../../types/permissions';
import { NAV_ITEMS } from './navConfig';
import { ticketScopeLabel } from '../../permissions/helpers';

interface Props {
  permissions: RolePermissions;
  // Below the mobile breakpoint the sidebar becomes an off-canvas drawer
  // (global.css `.sidebar.open`); these are no-ops on desktop, where CSS
  // keeps the sidebar permanently visible regardless of `open`.
  open?: boolean;
  onClose?: () => void;
}

// Single source of navigation truth (see CLAUDE.md / CHANGELOG.md 2026-07-23 —
// this replaced a duplicate sidebar+tab-row setup that showed the exact same
// items twice). The one dynamic label the old tab row carried (My tickets /
// Team tickets / Tickets, depending on role scope) is preserved as a small
// subtitle under the Tickets item instead of being lost.
export function Sidebar({ permissions, open, onClose }: Props) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <div className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img className="logo" src="/elevatoz-logo.png" alt="Elevatoz" />
          <div>
            <div className="sidebar-brand-name">ElevatoHub</div>
            <div className="sidebar-brand-tagline">Elevate your delivery.</div>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="sidebar-nav" onClick={onClose}>
          {NAV_ITEMS.filter((item) => item.show(permissions)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={16} />
              <span className="nav-item-label">
                {item.path === '/tickets' ? ticketScopeLabel(permissions) : item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
