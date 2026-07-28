import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { usersApi, UserRow } from '../../api/users';
import { ApiError } from '../../api/client';

const STATUSES = ['Planning', 'Active', 'OnHold', 'Completed'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

interface Props {
  onClose: () => void;
  onCreated: (code: string) => void;
}

export function CreateProjectModal({ onClose, onCreated }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    client: '',
    pmUserId: '',
    status: 'Planning',
    priority: 'Medium',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: '',
    memberUserIds: [] as string[],
  });

  useEffect(() => {
    usersApi.list().then((res) => {
      setUsers(res);
      if (res.length) set('pmUserId', res[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleMember(userId: string) {
    setForm((f) => ({
      ...f,
      memberUserIds: f.memberUserIds.includes(userId)
        ? f.memberUserIds.filter((id) => id !== userId)
        : [...f.memberUserIds, userId],
    }));
  }

  async function submit() {
    const code = form.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!code || !form.name.trim() || !form.client.trim() || !form.pmUserId) {
      setError('Code, name, client, and project manager are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await projectsApi.create({ ...form, code });
      onCreated(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">New project</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="cp-name">Project name</label>
              <input id="cp-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Compass — Partner Onboarding" />
            </div>
            <div className="field">
              <label htmlFor="cp-code">Project code</label>
              <input id="cp-code" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="e.g. COMPASS" maxLength={10} />
            </div>
            <div className="field">
              <label htmlFor="cp-client">Client</label>
              <input id="cp-client" value={form.client} onChange={(e) => set('client', e.target.value)} placeholder="Internal or client name" />
            </div>
            <div className="field">
              <label htmlFor="cp-pm">Project manager</label>
              <select id="cp-pm" value={form.pmUserId} onChange={(e) => set('pmUserId', e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cp-status">Status</label>
              <select id="cp-status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cp-priority">Priority</label>
              <select id="cp-priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cp-start">Start date</label>
              <input id="cp-start" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cp-end">End date</label>
              <input id="cp-end" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="cp-description">Description</label>
              <textarea id="cp-description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this project delivering, and for whom?" />
            </div>
            <div className="field full">
              <label id="cp-access-label">Access (optional — leave empty to leave it open to everyone their role already allows)</label>
              <div role="group" aria-labelledby="cp-access-label">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`watcher-chip ${form.memberUserIds.includes(u.id) ? 'active' : ''}`}
                    onClick={() => toggleMember(u.id)}
                    aria-pressed={form.memberUserIds.includes(u.id)}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            <Plus size={14} />
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}
