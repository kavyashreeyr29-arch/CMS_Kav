import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Trash2, UserPlus, X } from 'lucide-react';
import { usersApi, UserRow } from '../api/users';
import { rolesApi } from '../api/roles';
import { ApiError } from '../api/client';

const GROUP_ORDER = ['Full access', 'Field team', 'External'];

// Was one flat table with every user in the org rendered at once — on a
// real org with dozens/hundreds of accounts that's an unusable wall of rows
// (CHANGELOG.md "don't display all users, it's a big page"). Grouped by
// department (baseRole.group — the closest thing to a department field this
// data model has) into collapsible sections, with a search box instead of
// scrolling to find one person.
export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ id: string; label: string; group: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  // Minimized by default (CHANGELOG.md "don't display all users... provide
  // button and view all department wise") — each department starts
  // collapsed to a single summary row; click to expand that department's
  // member list.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUP_ORDER.map((g) => [g, true])),
  );

  function load() {
    setLoading(true);
    Promise.all([usersApi.list(), rolesApi.list()])
      .then(([u, r]) => { setUsers(u); setRoles(r); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function changeRole(id: string, baseRoleId: string) {
    await usersApi.update(id, { baseRoleId });
    load();
  }
  async function remove(id: string) {
    await usersApi.remove(id);
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, UserRow[]>();
    for (const u of filtered) {
      const group = u.baseRole?.group ?? 'Other';
      const list = byGroup.get(group) ?? [];
      list.push(u);
      byGroup.set(group, list);
    }
    const orderedGroups = [...GROUP_ORDER, ...[...byGroup.keys()].filter((g) => !GROUP_ORDER.includes(g))];
    return orderedGroups.filter((g) => byGroup.has(g)).map((g) => ({ group: g, members: byGroup.get(g)! }));
  }, [filtered]);

  const searching = search.trim().length > 0;

  if (loading) return <div className="loading-state">Loading users…</div>;

  return (
    <>
      <div className="filter-bar">
        <div className="select-pill">{users.length} users</div>
        <div className="search-box" style={{ maxWidth: 220 }}>
          <Search size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
          />
        </div>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowAdd(true)}>
          <UserPlus size={14} />Add user
        </button>
      </div>
      {grouped.map(({ group, members }) => {
        const isCollapsed = !searching && (collapsed[group] ?? false);
        return (
          <div className="panel" key={group} style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              className="wl-row-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px' }}
              onClick={() => setCollapsed((c) => ({ ...c, [group]: !c[group] }))}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span style={{ fontWeight: 700, fontSize: 13 }}>{group}</span>
              <span className="label-chip" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>{members.length}</span>
            </button>
            {!isCollapsed && (
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
                <tbody>
                  {members.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td className="mono" style={{ color: 'var(--ink-soft)' }}>{u.email}</td>
                      <td>
                        <select value={u.baseRoleId} onChange={(e) => changeRole(u.id, e.target.value)} aria-label={`Role for ${u.name}`}>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                      </td>
                      <td><button className="btn-destructive" onClick={() => remove(u.id)} title="Disable user" aria-label={`Disable ${u.name}`}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      {grouped.length === 0 && <div className="empty-state">No users match "{search}".</div>}
      {showAdd && <AddUserModal roles={roles} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </>
  );
}

function AddUserModal({
  roles, onClose, onCreated,
}: { roles: { id: string; label: string }[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Name, email, and an 8+ character password are required.');
      return;
    }
    setBusy(true);
    try {
      await usersApi.create({ name, email, password, baseRoleId: roleId });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="modal-title">Add user</div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        <div className="modal-body">
          <div className="field full"><label htmlFor="au-name">Full name</label><input id="au-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field full"><label htmlFor="au-email">Email</label><input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field full"><label htmlFor="au-password">Temporary password</label><input id="au-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="field full">
            <label htmlFor="au-role">Role</label>
            <select id="au-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={submit} disabled={busy}><UserPlus size={14} />Add user</button>
        </div>
      </div>
    </div>
  );
}
