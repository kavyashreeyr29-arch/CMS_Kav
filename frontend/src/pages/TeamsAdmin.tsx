import { useEffect, useState } from 'react';
import { Plus, Users as UsersIcon, X } from 'lucide-react';
import { teamsApi, TeamRow } from '../api/teams';
import { usersApi, UserRow } from '../api/users';
import { ApiError } from '../api/client';

// Admin-configurable Teams (CHANGELOG.md "admin should be able to create
// teams") — Team is what drives the 'team' permission scope (Lead/Manager
// seniority sees only their led team's projects/tickets/hours), so this is
// the missing management surface for a concept that already existed
// end-to-end in the data model, just with no admin UI to create/edit one.
export function TeamsAdmin() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TeamRow | 'new' | null>(null);

  function load() {
    setLoading(true);
    Promise.all([teamsApi.list(), usersApi.list()])
      .then(([t, u]) => { setTeams(t); setUsers(u); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <div className="loading-state">Loading teams…</div>;

  return (
    <>
      <div className="filter-bar">
        <div className="select-pill">{teams.length} teams</div>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing('new')}>
          <Plus size={14} />New team
        </button>
      </div>
      <div className="proj-grid">
        {teams.map((t) => (
          <button key={t.id} className="panel wl-row-btn" style={{ textAlign: 'left', display: 'block' }} onClick={() => setEditing(t)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <UsersIcon size={15} color="var(--brand)" />
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>
              Lead: {t.lead?.name ?? <span style={{ color: 'var(--ink-faint)' }}>Unassigned</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{t.memberships.length} member{t.memberships.length !== 1 ? 's' : ''}</div>
          </button>
        ))}
        {teams.length === 0 && <div className="empty-state">No teams yet — create one to enable team-scoped Lead/Manager visibility.</div>}
      </div>
      {editing && (
        <TeamModal
          team={editing === 'new' ? null : editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function TeamModal({ team, users, onClose, onSaved }: {
  team: TeamRow | null; users: UserRow[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(team?.name ?? '');
  const [leadUserId, setLeadUserId] = useState(team?.leadUserId ?? '');
  const [memberUserIds, setMemberUserIds] = useState<string[]>(team?.memberships.map((m) => m.userId) ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleMember(userId: string) {
    setMemberUserIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  }

  async function submit() {
    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = { name, leadUserId: leadUserId || undefined, memberUserIds };
      if (team) await teamsApi.update(team.id, body);
      else await teamsApi.create(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save team.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{team ? `Edit ${team.name}` : 'New team'}</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="team-name">Team name</label>
              <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Delivery Squad" />
            </div>
            <div className="field">
              <label htmlFor="team-lead">Lead</label>
              <select id="team-lead" value={leadUserId} onChange={(e) => setLeadUserId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field full">
            <label id="team-members-label">Members</label>
            <div role="group" aria-labelledby="team-members-label">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`watcher-chip ${memberUserIds.includes(u.id) ? 'active' : ''}`}
                  onClick={() => toggleMember(u.id)}
                  aria-pressed={memberUserIds.includes(u.id)}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            <Plus size={14} />{busy ? 'Saving…' : team ? 'Save changes' : 'Create team'}
          </button>
        </div>
      </div>
    </div>
  );
}
