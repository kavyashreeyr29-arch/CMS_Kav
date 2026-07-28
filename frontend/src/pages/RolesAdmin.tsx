import { useEffect, useState } from 'react';
import { Plus, Save, Shield, X } from 'lucide-react';
import { rolesApi, RoleMatrixRow } from '../api/roles';
import { RolePermissions, Scope, WorkHoursVisibility } from '../types/permissions';
import { ApiError } from '../api/client';

const PERMISSION_FIELDS: { key: keyof RolePermissions; label: string }[] = [
  { key: 'dashboard', label: 'Portfolio dashboard' },
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
  { key: 'restrictedStatuses', label: 'Restricted to Open / In Progress / Closed only' },
  { key: 'manageRoles', label: 'Create roles & edit any role\'s permissions (admin-level)' },
];

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'team', label: "Own team's tickets" },
  { value: 'source', label: "Own channel's tickets" },
  { value: 'reporter', label: 'Own raised tickets' },
];

const WORK_HOURS: { value: WorkHoursVisibility; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'own', label: 'Own only' },
  { value: 'team', label: 'Team' },
  { value: 'org', label: 'Org-wide' },
];

const BLANK_PERMISSIONS: RolePermissions = {
  scope: 'all', dashboard: false, projects: false, board: false, comms: false, createProject: false,
  userManagement: false, manageLabels: false, manageSLA: false, manageAI: false, adminAnalytics: false,
  simpleDashboard: false, canReopen: false, timeTracking: false, restrictedStatuses: false,
  workHoursVisibility: 'none', manageRoles: false,
};

// Admin-only "Roles & Permissions" editor (CHANGELOG.md "dynamic RBAC") —
// upgrades the read-only Role & Permission Matrix modal into something an
// admin can actually change: create a custom role, or edit any existing
// role's capabilities. Writes take effect immediately (no restart) since
// the backend cache (role-permissions.ts) is updated synchronously with the
// DB write — see backend/src/roles/roles.service.ts.
export function RolesAdmin() {
  const [rows, setRows] = useState<RoleMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RolePermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    rolesApi.permissionMatrix().then((res) => {
      setRows(res);
      if (!selectedId && res.length) select(res[0]);
    }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function select(row: RoleMatrixRow) {
    setSelectedId(row.id);
    setDraft({ ...row.permissions });
    setError('');
  }

  function setField<K extends keyof RolePermissions>(key: K, value: RolePermissions[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!selectedId || !draft) return;
    setSaving(true);
    setError('');
    try {
      await rolesApi.updatePermissions(selectedId, draft);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save permissions.');
    } finally {
      setSaving(false);
    }
  }

  const selectedRow = rows.find((r) => r.id === selectedId);

  if (loading) return <div className="loading-state">Loading roles…</div>;

  return (
    <>
      <div className="filter-bar">
        <div className="select-pill">{rows.length} roles</div>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>
          <Plus size={14} />New role
        </button>
      </div>
      <div className="row row-2">
        <div className="panel">
          <div className="panel-head"><div className="panel-title">Roles</div></div>
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className="wl-row-btn"
              style={{ display: 'block', background: r.id === selectedId ? 'var(--brand-soft)' : undefined, borderRadius: 8, padding: '6px 8px' }}
              onClick={() => select(r)}
              aria-pressed={r.id === selectedId}
            >
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>{r.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{r.group} · {r.id}</div>
            </button>
          ))}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">
                <Shield size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                {selectedRow ? `Editing: ${selectedRow.label}` : 'Select a role'}
              </div>
              <div className="panel-sub">Changes apply immediately — no restart, affects every user with this role right away.</div>
            </div>
          </div>
          {draft && (
            <>
              <div className="form-grid" style={{ marginBottom: 8 }}>
                <div className="field">
                  <label htmlFor="ra-scope">Ticket visibility scope</label>
                  <select id="ra-scope" value={draft.scope} onChange={(e) => setField('scope', e.target.value as Scope)}>
                    {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ra-workhours">Work-hours visibility</label>
                  <select id="ra-workhours" value={draft.workHoursVisibility} onChange={(e) => setField('workHoursVisibility', e.target.value as WorkHoursVisibility)}>
                    {WORK_HOURS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 12 }}>
                {PERMISSION_FIELDS.map((f) => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, cursor: 'pointer', padding: '3px 0' }}>
                    <input
                      type="checkbox"
                      checked={!!draft[f.key]}
                      onChange={(e) => setField(f.key, e.target.checked as never)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              {error && <div className="field-error" style={{ marginBottom: 8 }}>{error}</div>}
              <button className="btn-primary" onClick={save} disabled={saving}>
                <Save size={14} />{saving ? 'Saving…' : 'Save permissions'}
              </button>
            </>
          )}
        </div>
      </div>
      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </>
  );
}

function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [group, setGroup] = useState('Full access');
  const [permissions, setPermissions] = useState<RolePermissions>({ ...BLANK_PERMISSIONS });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function setField<K extends keyof RolePermissions>(key: K, value: RolePermissions[K]) {
    setPermissions((p) => ({ ...p, [key]: value }));
  }

  async function submit() {
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(id)) {
      setError('Role id must be lowercase snake_case (e.g. "release_manager"), 2-40 characters.');
      return;
    }
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await rolesApi.create({ id, label, group, permissions });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">New role</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="cr-id">Role id</label>
              <input id="cr-id" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} placeholder="release_manager" />
            </div>
            <div className="field">
              <label htmlFor="cr-label">Display label</label>
              <input id="cr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Release Manager" />
            </div>
            <div className="field">
              <label htmlFor="cr-group">Group</label>
              <select id="cr-group" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="Full access">Full access</option>
                <option value="Field team">Field team</option>
                <option value="External">External</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cr-scope">Ticket visibility scope</label>
              <select id="cr-scope" value={permissions.scope} onChange={(e) => setField('scope', e.target.value as Scope)}>
                {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', margin: '8px 0 4px' }}>
            {PERMISSION_FIELDS.map((f) => (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, cursor: 'pointer', padding: '3px 0' }}>
                <input
                  type="checkbox"
                  checked={!!permissions[f.key]}
                  onChange={(e) => setField(f.key, e.target.checked as never)}
                />
                {f.label}
              </label>
            ))}
          </div>
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}><Plus size={14} />{busy ? 'Creating…' : 'Create role'}</button>
        </div>
      </div>
    </div>
  );
}
