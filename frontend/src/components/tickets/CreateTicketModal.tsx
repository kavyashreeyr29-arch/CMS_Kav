import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Paperclip } from 'lucide-react';
import { ticketsApi } from '../../api/tickets';
import { projectsApi } from '../../api/projects';
import { labelsApi, LabelRow } from '../../api/labels';
import { businessCategoriesApi, BusinessCategoryRow } from '../../api/businessCategories';
import { usersApi, UserRow } from '../../api/users';
import { slaPoliciesApi, SlaPolicyRow } from '../../api/slaPolicies';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { MediaRecorderCapture } from '../ui/MediaRecorderCapture';
import { UploadedFileMeta } from '../../api/uploadFile';
import { Project } from '../../types/project';
import { Ticket } from '../../types/ticket';

// Files are staged under a client-generated id before the ticket exists —
// StorageService.buildStorageKey() just uses this as a folder name and never
// validates it, so a signed upload URL can be requested ahead of the real
// ticket id (see backend/src/tickets/tickets.service.ts
// requestAttachmentUploadUrl). Once the ticket is actually created, each
// staged file is attached via the normal POST /tickets/:id/attachments call.
function newStagingId(): string {
  return `staging-${crypto.randomUUID()}`;
}

function formatSlaMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Number(hours.toFixed(1))}h`;
  return `${Number((hours / 24).toFixed(1))}d`;
}

const TYPES = ['Story', 'Epic', 'Bug', 'Feature', 'Enhancement', 'Task', 'ChangeRequest', 'Support'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const SOURCES = ['InternalPM', 'CallCenter', 'CustomerSuccess', 'Operations', 'ClientPortal', 'Sales'];
// Mirrors backend's SOURCE_BY_ROLE (common/permissions/role-permissions.ts) —
// the read-only "Raised via" value shown to non-'all'-scope roles must match
// what ticketVisibilityWhere() actually scopes their tickets by, or a client
// would see a source value that isn't the one their own tickets are filtered
// on.
const SOURCE_BY_ROLE: Record<string, string> = {
  callcenter: 'CallCenter',
  customersuccess: 'CustomerSuccess',
  operations: 'Operations',
  client: 'ClientPortal',
};
// docs/prd-phase2.md §2.4 — must match backend's
// BUSINESS_CATEGORY_REQUIRED_ROLES (tickets.service.ts).
const BUSINESS_CATEGORY_REQUIRED_ROLES = ['customersuccess', 'pm', 'senior_developer', 'junior_developer', 'intern'];

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultProjectCode?: string;
}

export function CreateTicketModal({ onClose, onCreated, defaultProjectCode }: Props) {
  const { permissions, user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [businessCategories, setBusinessCategories] = useState<BusinessCategoryRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [epics, setEpics] = useState<Ticket[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<SlaPolicyRow[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stagingId] = useState(newStagingId);
  const [stagedFiles, setStagedFiles] = useState<UploadedFileMeta[]>([]);

  const [form, setForm] = useState({
    projectCode: defaultProjectCode ?? '',
    title: '',
    description: '',
    type: 'Task',
    priority: 'Medium',
    source: permissions?.scope === 'all' ? 'InternalPM' : (SOURCE_BY_ROLE[user?.role.id ?? ''] ?? 'InternalPM'),
    labelId: '',
    assigneeUserId: '',
    dueDate: '',
    parentTicketId: '',
    businessCategory: '',
    watcherUserIds: [] as string[],
  });

  const businessCategoryRequired = !!user && BUSINESS_CATEGORY_REQUIRED_ROLES.includes(user.role.id);
  // Internal staff names/watcher lists aren't something a client (reporter
  // scope) should see — they raise tickets, they don't route internal
  // notifications.
  const showWatchers = permissions?.scope !== 'reporter';

  useEffect(() => {
    projectsApi.list().then((res) => {
      setProjects(res);
      if (!form.projectCode && res.length) set('projectCode', res[0].code);
    });
    labelsApi.list().then(setLabels);
    businessCategoriesApi.list().then(setBusinessCategories);
    if (showWatchers) usersApi.list().then(setUsers);
    slaPoliciesApi.list().then(setSlaPolicies).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-matching SLA policy for the current project + priority selection —
  // prefers a project-specific + priority-specific match, falls back to
  // progressively broader (project-only, priority-only, org-wide) policies.
  const applicableSla = useMemo(() => {
    const project = projects.find((p) => p.code === form.projectCode);
    const candidates = slaPolicies
      .filter((s) => (s.projectId === null || s.projectId === project?.id) && (s.priority === null || s.priority === form.priority))
      .sort((a, b) => {
        const score = (s: SlaPolicyRow) => (s.projectId ? 2 : 0) + (s.priority ? 1 : 0);
        return score(b) - score(a);
      });
    return candidates[0] ?? null;
  }, [slaPolicies, projects, form.projectCode, form.priority]);

  // Parent-Epic picker only makes sense for a Story, and only within the
  // same project (a Story can't belong to another project's Epic).
  useEffect(() => {
    if (form.type !== 'Story' || !form.projectCode) {
      setEpics([]);
      return;
    }
    ticketsApi.list({ project: form.projectCode, type: 'Epic', pageSize: 100 }).then((res) => setEpics(res.data));
  }, [form.type, form.projectCode]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleWatcher(userId: string) {
    setForm((f) => ({
      ...f,
      watcherUserIds: f.watcherUserIds.includes(userId)
        ? f.watcherUserIds.filter((id) => id !== userId)
        : [...f.watcherUserIds, userId],
    }));
  }

  async function submit() {
    if (!form.title.trim() || !form.projectCode) {
      setError('Title and project are required.');
      return;
    }
    if (businessCategoryRequired && !form.businessCategory) {
      setError('Business category is required for your role.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const ticket = await ticketsApi.create({
        projectCode: form.projectCode,
        title: form.title,
        description: form.description,
        type: form.type,
        priority: form.priority,
        source: form.source,
        businessCategory: form.businessCategory || undefined,
        labelId: form.labelId || undefined,
        assigneeUserId: form.assigneeUserId || undefined,
        dueDate: form.dueDate || undefined,
        parentTicketId: form.type === 'Story' && form.parentTicketId ? form.parentTicketId : undefined,
        watcherUserIds: form.watcherUserIds.length ? form.watcherUserIds : undefined,
      });
      const ticketId = (ticket as { id: string }).id;
      await Promise.all(stagedFiles.map((meta) => ticketsApi.addAttachment(ticketId, meta)));
      onCreated();
      navigate(`/tickets/${ticketId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">New ticket</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="field full">
            <label htmlFor="ct-title">Title</label>
            <input id="ct-title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Checkout fails on Safari with saved cards" />
          </div>
          <div className="field full">
            <label htmlFor="ct-description">Description</label>
            <textarea id="ct-description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Steps to reproduce, expected behaviour, acceptance criteria…" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ct-project">Project</label>
              <select id="ct-project" value={form.projectCode} onChange={(e) => set('projectCode', e.target.value)}>
                {projects.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ct-source">Raised via</label>
              {permissions?.scope === 'all' ? (
                <select id="ct-source" value={form.source} onChange={(e) => set('source', e.target.value)}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input id="ct-source" value={form.source} disabled style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }} />
              )}
            </div>
            <div className="field">
              <label htmlFor="ct-label">Issue category / label</label>
              <select id="ct-label" value={form.labelId} onChange={(e) => set('labelId', e.target.value)}>
                <option value="">None</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ct-business-category">Business category{businessCategoryRequired ? ' *' : ''}</label>
              <select id="ct-business-category" value={form.businessCategory} onChange={(e) => set('businessCategory', e.target.value)}>
                <option value="">{businessCategoryRequired ? 'Select…' : 'None'}</option>
                {businessCategories.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ct-type">Type</label>
              <select id="ct-type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.type === 'Story' && (
              <div className="field">
                <label htmlFor="ct-parent-epic">Parent Epic</label>
                <select id="ct-parent-epic" value={form.parentTicketId} onChange={(e) => set('parentTicketId', e.target.value)}>
                  <option value="">None</option>
                  {epics.map((ep) => <option key={ep.id} value={ep.id}>{ep.displayId} — {ep.title}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="ct-priority">Priority</label>
              <select id="ct-priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {/* Assigning is an internal triage action — clients and field
                teams raise tickets, they don't route them to a specific
                person themselves (prd.md §4/§10). */}
            {permissions?.scope === 'all' && (
              <div className="field">
                <label htmlFor="ct-assignee">Assignee</label>
                <select id="ct-assignee" value={form.assigneeUserId} onChange={(e) => set('assigneeUserId', e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="ct-due-date">Due date</label>
              <input id="ct-due-date" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
          </div>
          {applicableSla && (
            <div className="field-note" style={{ marginBottom: 12 }}>
              Expected first response within <strong>{formatSlaMinutes(applicableSla.firstResponseTargetMinutes)}</strong>,
              resolution within <strong>{formatSlaMinutes(applicableSla.resolutionTargetMinutes)}</strong> — based on the
              selected project and priority.
            </div>
          )}
          {showWatchers && (
          <div className="field full">
            <label id="ct-watchers-label">Watchers (get notified on updates)</label>
            <div role="group" aria-labelledby="ct-watchers-label">
              {users.filter((u) => u.id !== form.assigneeUserId).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`watcher-chip ${form.watcherUserIds.includes(u.id) ? 'active' : ''}`}
                  onClick={() => toggleWatcher(u.id)}
                  aria-pressed={form.watcherUserIds.includes(u.id)}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
          )}
          <div className="field full">
            <label id="ct-attachments-label">Attachments</label>
            {stagedFiles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {stagedFiles.map((f, i) => (
                  <span key={i} className="status-chip" style={{ marginRight: 6, marginBottom: 4 }}>
                    <Paperclip size={11} />{f.fileName}
                  </span>
                ))}
              </div>
            )}
            <AttachmentUploader
              requestUploadUrl={(fileName) => ticketsApi.requestAttachmentUploadUrl(stagingId, fileName)}
              onUploaded={(meta) => setStagedFiles((f) => [...f, meta])}
              label="Drop files here or click to upload — documents, images, or videos"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <MediaRecorderCapture
                kind="audio"
                requestUploadUrl={(fileName) => ticketsApi.requestAttachmentUploadUrl(stagingId, fileName)}
                onUploaded={(meta) => setStagedFiles((f) => [...f, meta])}
              />
              <MediaRecorderCapture
                kind="video"
                requestUploadUrl={(fileName) => ticketsApi.requestAttachmentUploadUrl(stagingId, fileName)}
                onUploaded={(meta) => setStagedFiles((f) => [...f, meta])}
              />
            </div>
          </div>
          {error && <div className="field-error">{error}</div>}
          {!user && <div className="field-error">You must be signed in to create a ticket.</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            <Plus size={14} />
            {submitting ? 'Creating…' : 'Create & notify'}
          </button>
        </div>
      </div>
    </div>
  );
}
