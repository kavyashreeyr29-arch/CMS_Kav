import { useEffect, useState } from 'react';
import { CheckCircle2, Shield, X, XCircle } from 'lucide-react';
import { rolesApi, RoleMatrixRow } from '../../api/roles';
import { RolePermissions } from '../../types/permissions';

const PERMISSION_ROWS: { key: keyof RolePermissions; label: string }[] = [
  { key: 'dashboard', label: 'Portfolio dashboard & analytics' },
  { key: 'projects', label: 'Projects — view, create, document folders' },
  { key: 'board', label: 'Kanban board' },
  { key: 'comms', label: 'Comms & tracking audit log' },
  { key: 'simpleDashboard', label: 'Personal "my tickets" summary' },
  { key: 'createProject', label: 'Create new projects' },
  { key: 'userManagement', label: 'Create users & assign roles' },
  { key: 'manageLabels', label: 'Add / remove issue labels' },
  { key: 'manageSLA', label: 'Add / edit / remove SLA policies' },
  { key: 'manageAI', label: 'Configure AI integrations' },
  { key: 'timeTracking', label: 'Start / stop time tracking' },
  { key: 'adminAnalytics', label: 'Cross-project & time-period analytics' },
  { key: 'canReopen', label: 'Reopen a closed ticket' },
  { key: 'manageRoles', label: 'Create roles & edit permissions' },
  { key: 'manageWorkflow', label: 'Configure workflow gates & GitHub integration' },
];

const SCOPE_LABEL: Record<RolePermissions['scope'], string> = {
  all: 'Everything',
  team: "Own team's tickets",
  source: "Own team's tickets",
  reporter: 'Own tickets',
};

export function RoleMatrixModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<RoleMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rolesApi.permissionMatrix().then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Shield size={15} />Role & permission matrix
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.5 }}>
            Admin and management roles see every project and dashboard, and Admin can also manage users.
            Field-team roles can raise tickets, comment, take updates, and close their own team&apos;s
            tickets. Clients can raise, track, comment, close, and reopen only their own tickets. This is
            enforced server-side (not just hidden in the UI) — see <code>backend/src/common/permissions/</code>.
          </div>
          {loading ? (
            <div className="loading-state">Loading permission matrix…</div>
          ) : (
            <div className="table-scroll">
              <table className="perm-table">
                <thead>
                  <tr>
                    <th>Capability</th>
                    {rows.map((r) => (
                      <th key={r.id}>
                        <div className="perm-role-head"><span>{r.label}</span><span>{r.group}</span></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      {rows.map((r) => (
                        <td key={r.id}>
                          {r.permissions[row.key]
                            ? <CheckCircle2 size={15} color="#16946E" />
                            : <XCircle size={15} color="#D3D6E0" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td>Ticket visibility scope</td>
                    {rows.map((r) => <td key={r.id} style={{ fontSize: 10 }}>{SCOPE_LABEL[r.permissions.scope]}</td>)}
                  </tr>
                  <tr>
                    <td>Status changes allowed</td>
                    {rows.map((r) => (
                      <td key={r.id} style={{ fontSize: 10 }}>
                        {r.permissions.restrictedStatuses ? 'Open · In Progress · Closed' : 'All statuses'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Work-hours visibility</td>
                    {rows.map((r) => <td key={r.id} style={{ fontSize: 10, textTransform: 'capitalize' }}>{r.permissions.workHoursVisibility}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 12 }}>
            To see the app as a different role, sign out and use the quick-login panel on the login screen
            (test-only — see <code>CLAUDE.md</code>).
          </div>
        </div>
      </div>
    </div>
  );
}
