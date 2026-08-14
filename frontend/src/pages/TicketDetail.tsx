import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity, Building2, Check, Clock, Copy, Download, Edit3, GitBranchPlus, History, Layers, MessageSquare, Paperclip, PlayCircle,
  RotateCcw, Send, StopCircle, Timer, Trash2, Unlink, Users as UsersIcon, X,
} from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { usersApi, UserRow } from '../api/users';
import { labelsApi, LabelRow } from '../api/labels';
import { businessCategoriesApi, BusinessCategoryRow } from '../api/businessCategories';
import { teamsApi, TeamRow } from '../api/teams';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { PrioChip, SourceChip, LabelChip, CrossTeamBadge, formatStatus } from '../components/ui/Chips';
import { SlaBadge } from '../components/ui/SlaBadge';
import { AttachmentUploader } from '../components/ui/AttachmentUploader';
import { AttachmentGrid } from '../components/ui/AttachmentGrid';
import { formatDuration } from '../components/ui/formatDuration';
import { Linkify } from '../components/ui/Linkify';
import { exportToCsv } from '../components/ui/exportCsv';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { QaTestCasesPanel } from '../components/tickets/QaTestCasesPanel';
import { DevelopmentPanel } from '../components/tickets/DevelopmentPanel';
import { ApprovalsPanel } from '../components/tickets/ApprovalsPanel';
import { CreateTicketModal } from '../components/tickets/CreateTicketModal';
import { workflowApi, WorkflowTransitionRow } from '../api/workflow';
import { ActivityEntry, FieldChange, Ticket } from '../types/ticket';

const RESTRICTED_STATUSES = ['Open', 'InProgress', 'Closed'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
// PRD Phase 2 §3.2 — must match backend/src/tickets/tickets.service.ts EDITABLE_STATUSES.
const EDITABLE_STATUSES = ['Open', 'Reopened'];

interface EditForm {
  title: string;
  description: string;
  priority: string;
  labelId: string;
  dueDate: string;
  assigneeUserId: string;
  businessCategory: string;
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { permissions, user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [fieldChanges, setFieldChanges] = useState<FieldChange[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [businessCategories, setBusinessCategories] = useState<BusinessCategoryRow[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowTransitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [watcherToAdd, setWatcherToAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamToAdd, setTeamToAdd] = useState('');

  function load() {
    if (!id) return;
    setLoading(true);
    ticketsApi.get(id).then(setTicket).catch(() => setError('Ticket not found or not visible to your role.')).finally(() => setLoading(false));
    ticketsApi.history(id).then(setActivity).catch(() => {});
    ticketsApi.fieldChanges(id).then(setFieldChanges).catch(() => {});
  }

  useEffect(load, [id]);
  useEffect(() => { usersApi.list().then(setUsers).catch(() => {}); }, []);
  useEffect(() => { labelsApi.list().then(setLabels).catch(() => {}); }, []);
  useEffect(() => { businessCategoriesApi.list().then(setBusinessCategories).catch(() => {}); }, []);
  useEffect(() => { workflowApi.list().then(setWorkflow).catch(() => {}); }, []);
  useEffect(() => { teamsApi.list().then(setTeams).catch(() => {}); }, []);

  if (loading) return <div className="loading-state">Loading ticket…</div>;
  if (error || !ticket) return <div className="error-state">{error || 'Ticket not found.'}</div>;
  if (!permissions) return null;

  // Source/reporter-scoped roles keep their fixed coarse set; everyone else's
  // picker is driven by the admin-configured workflow — only valid transition
  // targets from the current status (plus the current status itself) are
  // offered, so the UI mirrors what the server-side gates will accept.
  const workflowTargets = workflow.filter((t) => t.fromStatus === ticket.status).map((t) => t.toStatus);
  const statusOptions = permissions.restrictedStatuses
    ? Array.from(new Set([...RESTRICTED_STATUSES, ticket.status]))
    : Array.from(new Set([ticket.status, ...workflowTargets]));
  // The transition (if any) currently blocking on a requiresApproval gate —
  // its suggested label pre-fills the Approvals panel's "Send for approval" form.
  const approvalGateTransition = workflow.find((t) => t.fromStatus === ticket.status && t.requiresApproval);
  const canReopenNow = permissions.canReopen && ['Completed', 'Closed'].includes(ticket.status);
  const myRunningEntry = ticket.timeEntries?.find((e) => e.userId === user?.id && !e.endedAt);
  // "Start date" per the user's definition is when work actually began
  // (first timer start), not the manually-set planned startDate field.
  const actualStart = ticket.timeEntries?.length
    ? ticket.timeEntries.reduce((earliest, e) => (e.startedAt < earliest ? e.startedAt : earliest), ticket.timeEntries[0].startedAt)
    : null;
  const userById = new Map(users.map((u) => [u.id, u]));
  const watcherCandidates = users.filter((u) => !ticket.watcherUserIds.includes(u.id));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const collaboratingTeamCandidates = teams.filter((t) => !ticket.collaboratingTeamIds.includes(t.id));

  // PRD Phase 2 §3.2 — only the reporter or a full-access (scope: 'all'/'team')
  // role can edit, and only while the ticket is Open/Reopened; enforced again
  // server-side (backend/src/tickets/tickets.service.ts updateFields) so this
  // is UX convenience, not the actual gate.
  const canEdit =
    EDITABLE_STATUSES.includes(ticket.status) &&
    (ticket.reporter?.id === user?.id || permissions.scope === 'all' || permissions.scope === 'team');

  // docs/prd-phase2.md §12 — QA evidence renders separately from general
  // attachments; adding/executing test cases is limited to internal
  // delivery roles client-side (server has no extra gate beyond ticket
  // visibility, same as comments).
  const generalAttachments = (ticket.attachments ?? []).filter((a) => a.context !== 'qa');
  const qaAttachments = (ticket.attachments ?? []).filter((a) => a.context === 'qa');
  const canManageQa = permissions.scope === 'all' || permissions.scope === 'team';
  // Creating sub-tasks / detaching from a parent is a structural change, not
  // a field edit — same internal-delivery-role gate as QA management rather
  // than canEdit's Open-only status restriction, since re-parenting a ticket
  // makes sense at any point in its lifecycle.
  const canManageStructure = permissions.scope === 'all' || permissions.scope === 'team';

  function startEdit() {
    setEditForm({
      title: ticket!.title,
      description: ticket!.description ?? '',
      priority: ticket!.priority,
      labelId: ticket!.labelId ?? '',
      dueDate: ticket!.dueDate ? ticket!.dueDate.slice(0, 10) : '',
      assigneeUserId: ticket!.assigneeId ?? '',
      businessCategory: ticket!.businessCategory ?? '',
    });
    setEditMode(true);
  }

  async function saveEdit() {
    if (!id || !editForm) return;
    setBusy(true);
    setError('');
    try {
      await ticketsApi.updateFields(id, {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        labelId: editForm.labelId,
        dueDate: editForm.dueDate,
        assigneeUserId: editForm.assigneeUserId,
        businessCategory: editForm.businessCategory,
      });
      setEditMode(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: string) {
    if (!id || status === ticket!.status) return;
    setBusy(true);
    try {
      await ticketsApi.updateStatus(id, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!id) return;
    setBusy(true);
    try {
      await ticketsApi.reopen(id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    if (!id || !comment.trim()) return;
    setBusy(true);
    try {
      await ticketsApi.addComment(id, comment);
      setComment('');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleTimer() {
    if (!id) return;
    setBusy(true);
    try {
      if (myRunningEntry) await ticketsApi.stopTimer(id);
      else await ticketsApi.startTimer(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the timer.');
    } finally {
      setBusy(false);
    }
  }

  async function addWatcher() {
    if (!id || !watcherToAdd) return;
    setBusy(true);
    try {
      await ticketsApi.addWatcher(id, watcherToAdd);
      setWatcherToAdd('');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function addCollaboratingTeam() {
    if (!id || !teamToAdd) return;
    setBusy(true);
    try {
      await ticketsApi.linkCollaboratingTeams(id, [...ticket!.collaboratingTeamIds, teamToAdd]);
      setTeamToAdd('');
      load();
    } finally {
      setBusy(false);
    }
  }

  async function removeCollaboratingTeam(teamId: string) {
    if (!id) return;
    setBusy(true);
    try {
      await ticketsApi.linkCollaboratingTeams(id, ticket!.collaboratingTeamIds.filter((t) => t !== teamId));
      load();
    } finally {
      setBusy(false);
    }
  }

  // Copies a displayId-based URL rather than the current (UUID-based)
  // window.location.href — shorter and human-readable when pasted into
  // another ticket's comment, and resolves the same way since
  // GET /tickets/:id now accepts either form (tickets.service.ts findOne).
  async function remove() {
    if (!id) return;
    setBusy(true);
    setDeleteError('');
    try {
      await ticketsApi.remove(id);
      navigate(-1);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete ticket.');
      setBusy(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/tickets/${ticket!.displayId}`;
    navigator.clipboard?.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function convertToStandalone() {
    if (!id) return;
    setBusy(true);
    try {
      await ticketsApi.linkParent(id, null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not convert this ticket.');
    } finally {
      setBusy(false);
    }
  }

  function exportActivity() {
    exportToCsv(
      `${ticket!.displayId}-activity`,
      ['Time', 'Actor', 'Action'],
      activity.map((a) => [new Date(a.createdAt).toLocaleString(), a.actor?.name ?? '', a.actionText]),
    );
  }
  function exportAttachments() {
    exportToCsv(
      `${ticket!.displayId}-attachments`,
      ['File name', 'Type', 'Size (bytes)', 'Uploaded'],
      generalAttachments.map((a) => [a.fileName, a.mimeKind, a.fileSize, new Date(a.createdAt).toLocaleString()]),
    );
  }
  function exportFieldChanges() {
    exportToCsv(
      `${ticket!.displayId}-change-history`,
      ['Time', 'Field', 'From', 'To', 'Changed by'],
      fieldChanges.map((c) => [new Date(c.changedAt).toLocaleString(), c.fieldName, c.oldValue ?? '', c.newValue ?? '', c.changer?.name ?? '']),
    );
  }

  return (
    <div className="ticket-detail-layout">
      <div className="ticket-detail-main panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="tid mono" style={{ fontSize: 13 }}>{ticket.displayId}</div>
            <SlaBadge slaBreached={ticket.slaBreached} slaBreachRisk={ticket.slaBreachRisk} />
            <CrossTeamBadge
              count={ticket.collaboratingTeamIds.length}
              names={ticket.collaboratingTeamIds.map((tid) => teamById.get(tid)?.name ?? tid)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-ghost" onClick={copyLink} title="Copy a link to this ticket">
              {linkCopied ? <><Check size={13} style={{ marginRight: 5 }} />Copied</> : <><Copy size={13} style={{ marginRight: 5 }} />Copy link</>}
            </button>
            {canEdit && !editMode && (
              <button className="btn-ghost" onClick={startEdit}><Edit3 size={13} style={{ marginRight: 5 }} />Edit</button>
            )}
            {permissions.userManagement && (
              <button className="btn-destructive" data-testid="td-delete-ticket" onClick={() => setConfirmingDelete(true)} title="Delete ticket">
                <Trash2 size={13} />
              </button>
            )}
            <button className="modal-close" onClick={() => navigate(-1)} aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        {!editMode ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>{ticket.title}</div>
            {ticket.label && <div style={{ marginBottom: 14 }}><LabelChip l={ticket.label.name} /></div>}
          </>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div className="field full">
              <label htmlFor="td-title">Title</label>
              <input id="td-title" value={editForm!.title} onChange={(e) => setEditForm((f) => ({ ...f!, title: e.target.value }))} />
            </div>
            <div className="field full">
              <label htmlFor="td-description">Description</label>
              <textarea id="td-description" value={editForm!.description} onChange={(e) => setEditForm((f) => ({ ...f!, description: e.target.value }))} rows={4} />
            </div>
          </div>
        )}

        {!editMode && (
          <>
            {canReopenNow && (
              <div className="reopen-banner">
                <span><RotateCcw size={13} style={{ verticalAlign: -2, marginRight: 5 }} />This ticket is {formatStatus(ticket.status)}. If the issue isn't resolved, you can reopen it.</span>
                <button className="btn-destructive" onClick={reopen} disabled={busy}><RotateCcw size={12} />Reopen ticket</button>
              </div>
            )}
            {!canEdit && ticket.status !== 'Open' && ticket.status !== 'Reopened' && (
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 14 }}>
                Title and description are locked once work has moved past Open — add a comment for further changes.
              </div>
            )}
            {ticket.description && <div className="td-desc"><Linkify text={ticket.description} /></div>}
          </>
        )}

        {ticket.parent && (
          <div className="td-parent-info" style={{ marginBottom: 12, fontSize: 11.5, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>
              Part of: <span className="tid" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${ticket.parent!.id}`)}>{ticket.parent.displayId}</span> — {ticket.parent.title}
            </span>
            {canManageStructure && (
              <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10.5 }} onClick={convertToStandalone} disabled={busy} title="Remove this ticket from its parent">
                <Unlink size={11} style={{ marginRight: 4 }} />Convert to standalone ticket
              </button>
            )}
          </div>
        )}

        {(canManageStructure || (ticket.children?.length ?? 0) > 0) && (
          <div style={{ marginBottom: 18 }}>
            <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={13} />Sub-tasks ({ticket.children?.length ?? 0})</span>
              {canManageStructure && (
                <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10.5 }} onClick={() => setShowSubtaskModal(true)}>
                  <GitBranchPlus size={11} style={{ marginRight: 4 }} />Add sub-task
                </button>
              )}
            </div>
            {ticket.children?.map((c) => (
              <div key={c.id} className="timeline-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${c.id}`)}>
                <div className="timeline-dot" />
                <div><span className="tid">{c.displayId}</span> {c.title} {c.status && <span className="activity-time">· {formatStatus(c.status)}</span>}</div>
              </div>
            ))}
            {(ticket.children?.length ?? 0) === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>No sub-tasks yet.</div>}
          </div>
        )}

        {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}

        {editMode && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button className="btn-primary" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button className="btn-ghost" onClick={() => setEditMode(false)} disabled={busy}>Cancel</button>
          </div>
        )}

        <QaTestCasesPanel
          ticketId={id!}
          canManage={canManageQa}
          evidence={qaAttachments}
          onEvidenceChanged={load}
        />

        {permissions.scope !== 'reporter' && (
          <DevelopmentPanel displayId={ticket.displayId} pullRequests={ticket.pullRequests ?? []} onChanged={load} />
        )}

        {permissions.scope !== 'reporter' && (
          <ApprovalsPanel ticketId={id!} users={users} suggestedLabel={approvalGateTransition?.approvalLabel ?? undefined} />
        )}

        <div style={{ marginBottom: 18 }}>
          <div className="td-section-title"><MessageSquare size={13} />Comments ({ticket.comments?.length ?? 0})</div>
          {ticket.comments?.map((c) => (
            <div className="comment-item" key={c.id}>
              <div className="activity-avatar">{(c.author?.name ?? '?').split(' ').map((s) => s[0]).join('').slice(0, 2)}</div>
              <div className="comment-body">
                <span className="comment-author">{c.author?.name}<span className="comment-time">{new Date(c.createdAt).toLocaleString()}</span></span>
                <div className="comment-text"><Linkify text={c.body} /></div>
              </div>
            </div>
          ))}
          <div className="comment-input-row">
            <textarea placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            <button className="send-btn" onClick={submitComment} disabled={busy}><Send size={15} /></button>
          </div>
        </div>

        <div data-testid="ticket-activity">
          <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={13} />Activity</span>
            <button className="btn-ghost" onClick={exportActivity} disabled={activity.length === 0}><Download size={11} />CSV</button>
          </div>
          {activity.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>No activity recorded yet.</div>}
          {activity.map((a) => (
            <div className="timeline-item" key={a.id}>
              <div className="timeline-dot" />
              <div>
                <strong>{a.actor?.name ?? 'Someone'}</strong> {a.actionText}
                {a.aiAssisted && <span className="label-chip" style={{ marginLeft: 6, background: 'var(--brand-soft)', color: 'var(--brand)' }}>AI-assisted</span>}
                {' '}<span className="activity-time">· {new Date(a.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ticket-detail-side">
        <div className="panel">
          <div className="td-meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="td-meta-item">
              <label className="td-meta-label" htmlFor="td-status">Status</label>
              <select id="td-status" value={ticket.status} onChange={(e) => changeStatus(e.target.value)} disabled={busy} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, padding: 0 }}>
                {statusOptions.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
            <div className="td-meta-item">
              {editMode ? (
                <>
                  <label className="td-meta-label" htmlFor="td-priority">Priority</label>
                  <select id="td-priority" value={editForm!.priority} onChange={(e) => setEditForm((f) => ({ ...f!, priority: e.target.value }))} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, padding: 0 }}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <div className="td-meta-label">Priority</div>
                  <div className="td-meta-value"><PrioChip p={ticket.priority} /></div>
                </>
              )}
            </div>
            <div className="td-meta-item"><div className="td-meta-label">Raised via</div><div className="td-meta-value"><SourceChip s={ticket.source} /></div></div>
            <div className="td-meta-item"><div className="td-meta-label">Reporter</div><div className="td-meta-value">{ticket.reporter?.name ?? '—'}</div></div>
            <div className="td-meta-item">
              {editMode && permissions.scope === 'all' ? (
                <>
                  <label className="td-meta-label" htmlFor="td-assignee">Assignee</label>
                  <select id="td-assignee" value={editForm!.assigneeUserId} onChange={(e) => setEditForm((f) => ({ ...f!, assigneeUserId: e.target.value }))} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, padding: 0 }}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <div className="td-meta-label">{permissions.scope === 'reporter' ? 'Handled by' : 'Assignee'}</div>
                  <div className="td-meta-value">{ticket.assigneeDisplay ?? 'Unassigned'}</div>
                </>
              )}
            </div>
            <div className="td-meta-item">
              {editMode ? (
                <>
                  <label className="td-meta-label" htmlFor="td-due">Due</label>
                  <input id="td-due" type="date" value={editForm!.dueDate} onChange={(e) => setEditForm((f) => ({ ...f!, dueDate: e.target.value }))} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, padding: 0 }} />
                </>
              ) : (
                <>
                  <div className="td-meta-label">Due</div>
                  <div className="td-meta-value mono">{ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</div>
                </>
              )}
            </div>
            <div className="td-meta-item">
              <div className="td-meta-label">Created</div>
              <div className="td-meta-value mono">{new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
            </div>
            <div className="td-meta-item">
              <div className="td-meta-label">Last modified</div>
              <div className="td-meta-value mono">{new Date(ticket.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
            </div>
            <div className="td-meta-item">
              <div className="td-meta-label" title="Day work actually began — the first time someone started a timer on this ticket">Started</div>
              <div className="td-meta-value mono">{actualStart ? new Date(actualStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Not started'}</div>
            </div>
            <div className="td-meta-item">
              <div className="td-meta-label">Closed</div>
              <div className="td-meta-value mono">{ticket.closedAt ? new Date(ticket.closedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</div>
            </div>
            {(editMode || ticket.businessCategory) && (
              <div className="td-meta-item">
                {editMode ? (
                  <>
                    <label className="td-meta-label" htmlFor="td-business-category">Business category</label>
                    <select id="td-business-category" value={editForm!.businessCategory} onChange={(e) => setEditForm((f) => ({ ...f!, businessCategory: e.target.value }))} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, padding: 0 }}>
                      <option value="">None</option>
                      {businessCategories.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <div className="td-meta-label">Business category</div>
                    <div className="td-meta-value">{ticket.businessCategory}</div>
                  </>
                )}
              </div>
            )}
            {editMode && (
              <div className="td-meta-item" style={{ gridColumn: '1 / -1' }}>
                <label className="td-meta-label" htmlFor="td-label">Label</label>
                <select id="td-label" value={editForm!.labelId} onChange={(e) => setEditForm((f) => ({ ...f!, labelId: e.target.value }))} style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, padding: 0 }}>
                  <option value="">None</option>
                  {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="panel" data-testid="td-watchers">
          <div className="td-section-title"><UsersIcon size={13} />Watchers ({ticket.watcherUserIds.length})</div>
          <div style={{ marginBottom: 8 }}>
            {ticket.watcherUserIds.map((uid) => (
              <span key={uid} className="watcher-chip active">{userById.get(uid)?.name ?? uid}</span>
            ))}
            {ticket.watcherUserIds.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>No watchers yet.</span>}
          </div>
          {watcherCandidates.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={watcherToAdd} onChange={(e) => setWatcherToAdd(e.target.value)} style={{ maxWidth: 220 }} aria-label="Add a watcher">
                <option value="">Add a watcher…</option>
                {watcherCandidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className="btn-ghost" onClick={addWatcher} disabled={!watcherToAdd || busy}>Add</button>
            </div>
          )}
        </div>

        {(canManageStructure || ticket.collaboratingTeamIds.length > 0) && (
          <div className="panel" data-testid="td-collaborating-teams">
            <div className="td-section-title" title="Other teams that need visibility to help resolve this ticket, beyond its own project's team">
              <Building2 size={13} />Collaborating teams ({ticket.collaboratingTeamIds.length})
            </div>
            <div style={{ marginBottom: 8 }}>
              {ticket.collaboratingTeamIds.map((tid) => (
                <span key={tid} className="watcher-chip active">
                  {teamById.get(tid)?.name ?? tid}
                  {canManageStructure && (
                    <X size={11} style={{ marginLeft: 4, cursor: 'pointer' }} onClick={() => removeCollaboratingTeam(tid)} />
                  )}
                </span>
              ))}
              {ticket.collaboratingTeamIds.length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Only this ticket's own project team has visibility.</span>
              )}
            </div>
            {canManageStructure && collaboratingTeamCandidates.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={teamToAdd} onChange={(e) => setTeamToAdd(e.target.value)} style={{ maxWidth: 220 }} aria-label="Add a collaborating team">
                  <option value="">Add a team…</option>
                  {collaboratingTeamCandidates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="btn-ghost" onClick={addCollaboratingTeam} disabled={!teamToAdd || busy}>Add</button>
              </div>
            )}
          </div>
        )}

        {permissions.scope === 'all' && (
          <div className="panel">
            <div className="td-section-title"><Timer size={13} />Time tracking</div>
            {permissions.timeTracking && (
              <button className={`timer-btn ${myRunningEntry ? 'timer-btn-stop' : 'timer-btn-start'}`} onClick={toggleTimer} disabled={busy}>
                {myRunningEntry ? <><StopCircle size={14} />Stop timer</> : <><PlayCircle size={14} />Start timer</>}
              </button>
            )}
            {(ticket.timeEntries?.length ?? 0) > 0 && (
              <div style={{ marginTop: 10 }}>
                {ticket.timeEntries!.slice().reverse().map((e) => (
                  <div className="timeline-item" key={e.id}>
                    <div className="timeline-dot" style={{ background: e.endedAt ? 'var(--brand)' : 'var(--critical)' }} />
                    <div>
                      {e.user?.name ?? 'Someone'} {e.endedAt ? `logged ${formatDuration(e.durationMinutes)}` : <span style={{ color: 'var(--critical)', fontWeight: 600 }}>timer running…</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="panel">
          <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={13} />Attachments ({generalAttachments.length})</span>
            <button className="btn-ghost" onClick={exportAttachments} disabled={generalAttachments.length === 0}><Download size={11} />CSV</button>
          </div>
          <AttachmentGrid
            files={generalAttachments}
            getDownloadUrl={(attachmentId) => ticketsApi.getAttachmentDownloadUrl(id!, attachmentId)}
          />
          <div style={{ marginTop: 8 }}>
            <AttachmentUploader
              requestUploadUrl={(fileName) => ticketsApi.requestAttachmentUploadUrl(id!, fileName)}
              onUploaded={async (meta) => { await ticketsApi.addAttachment(id!, meta); load(); }}
            />
          </div>
        </div>

        <div className="panel">
          <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><History size={13} />Change history ({fieldChanges.length})</span>
            <button className="btn-ghost" onClick={exportFieldChanges} disabled={fieldChanges.length === 0}><Download size={11} />CSV</button>
          </div>
          {fieldChanges.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>No field changes recorded yet.</div>}
          {fieldChanges.map((c) => (
            <div className="timeline-item" key={c.id}>
              <div className="timeline-dot" />
              <div style={{ fontSize: 11.5 }}>
                <strong>{c.fieldName}</strong> changed from <em>"{c.oldValue ?? '—'}"</em> to <em>"{c.newValue ?? '—'}"</em> by {c.changer?.name ?? 'Someone'}
                {' '}<span className="activity-time"><Clock size={9} style={{ verticalAlign: -1 }} /> {new Date(c.changedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSubtaskModal && (
        <CreateTicketModal
          onClose={() => setShowSubtaskModal(false)}
          onCreated={load}
          subtaskOf={{ id: ticket.id, displayId: ticket.displayId, title: ticket.title, projectCode: ticket.project?.code ?? '' }}
        />
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${ticket.displayId}?`}
          body="This permanently removes the ticket along with its comments, attachments, PRs, approvals, and time entries. This can't be undone."
          busy={busy}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
