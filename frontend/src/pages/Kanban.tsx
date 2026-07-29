import { DragEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { GripVertical, Timer } from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { workflowApi, WorkflowTransitionRow } from '../api/workflow';
import { PrioChip, formatStatus } from '../components/ui/Chips';
import { ApiError } from '../api/client';
import { Ticket } from '../types/ticket';
import { ProjectFilterContext } from '../components/layout/AppShell';

// Status is the classic column layout; the others turn the board into
// swimlanes grouped by that dimension, with tickets kept in status order
// inside each lane — so one board answers "where is everything", "who's
// loaded", "what's urgent", "what kind of work", and "which epic".
type GroupBy = 'status' | 'assignee' | 'priority' | 'type' | 'epic';
const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'type', label: 'Type' },
  { key: 'epic', label: 'Epic' },
];

const STATUS_COLUMNS = ['Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Completed'];
const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITY_COLOR: Record<string, string> = { Critical: '#E2483B', High: '#F5A524', Medium: '#3B6CF4', Low: '#7C8598' };

export function Kanban() {
  const navigate = useNavigate();
  const { projectFilter } = useOutletContext<ProjectFilterContext>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowTransitionRow[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    setLoading(true);
    ticketsApi
      .list({ project: projectFilter === 'ALL' ? undefined : projectFilter, pageSize: 200 })
      .then((res) => setTickets(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [projectFilter]);
  useEffect(() => { workflowApi.list().then(setWorkflow).catch(() => {}); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id);
  }

  // Status columns only accept a drop when the workflow allows that transition;
  // the drop still round-trips to the server (the real gate), and a rejection
  // (e.g. "merge a PR first") is surfaced as a toast instead of silently failing.
  async function onDropStatus(e: DragEvent, status: string) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.status === status) return;
    try {
      await ticketsApi.updateStatus(id, status);
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not move that ticket.');
    }
  }

  const allowedTargets = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of workflow) {
      if (!map.has(t.fromStatus)) map.set(t.fromStatus, new Set());
      map.get(t.fromStatus)!.add(t.toStatus);
    }
    return map;
  }, [workflow]);

  if (loading) return <div className="loading-state">Loading board…</div>;

  const toolbar = (
    <div className="board-toolbar">
      <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Group by</span>
      <div className="seg" role="tablist" aria-label="Group board by">
        {GROUP_OPTIONS.map((o) => (
          <button key={o.key} className={groupBy === o.key ? 'active' : ''} onClick={() => setGroupBy(o.key)} role="tab" aria-selected={groupBy === o.key}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const card = (t: Ticket) => (
    <div
      key={t.id}
      className="kcard"
      draggable={groupBy === 'status'}
      onDragStart={(e) => onDragStart(e, t.id)}
      onClick={() => navigate(`/tickets/${t.id}`)}
      style={{ borderLeftColor: PRIORITY_COLOR[t.priority] }}
    >
      <div className="kcard-id-row">
        <span className="kcard-id">{t.displayId}</span>
        {groupBy === 'status' && <GripVertical size={11} color="#C4C8D6" />}
      </div>
      <div className="kcard-title">{t.title}</div>
      {t.description && <div className="kcard-desc">{t.description}</div>}
      {(t._count?.pullRequests ?? 0) > 0 && (
        <div className="kcard-timer" style={{ marginBottom: 6, color: '#8250DF' }}>
          {t._count!.pullRequests} PR{t._count!.pullRequests! > 1 ? 's' : ''} linked
        </div>
      )}
      {t.hasRunningTimer && (
        <div className="kcard-timer" style={{ marginBottom: 6 }}>
          <span className="kcard-timer-dot" /><Timer size={9} />Timer running
        </div>
      )}
      <div className="kcard-foot">
        <PrioChip p={t.priority} small />
        <div className="kcard-assignee">{(t.assigneeDisplay ?? '?').slice(0, 2)}</div>
      </div>
    </div>
  );

  // ---- Status view: draggable columns, workflow-aware drop targets --------
  if (groupBy === 'status') {
    return (
      <>
        {toolbar}
        <div className="kanban">
          {STATUS_COLUMNS.map((col) => {
            const items = tickets.filter((t) => t.status === col);
            return (
              <div
                key={col}
                className={`kcol ${dragOverCol === col ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => onDropStatus(e, col)}
              >
                <div className="kcol-head">
                  <div className="kcol-title">{formatStatus(col)}</div>
                  <div className="kcol-count">{items.length}</div>
                </div>
                {items.slice(0, 30).map(card)}
              </div>
            );
          })}
        </div>
        {toast && <div className="board-blocked-toast" role="alert">{toast}</div>}
      </>
    );
  }

  // ---- Grouped swimlane views (read-only rearrangement) -------------------
  const lanes = buildLanes(tickets, groupBy);
  return (
    <>
      {toolbar}
      {lanes.map((lane) => (
        <div className="swimlane" key={lane.key}>
          <div className="swimlane-head">
            {lane.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: lane.color, display: 'inline-block' }} />}
            {lane.label}
            <span className="swimlane-count">{lane.tickets.length}</span>
          </div>
          <div className="kanban" style={{ minHeight: 0 }}>
            {lane.tickets.slice(0, 40).map(card)}
          </div>
        </div>
      ))}
      {lanes.length === 0 && <div className="empty-state">No tickets to show.</div>}
      {toast && <div className="board-blocked-toast" role="alert">{toast}</div>}
    </>
  );
}

interface Lane { key: string; label: string; color?: string; tickets: Ticket[] }

function buildLanes(tickets: Ticket[], groupBy: GroupBy): Lane[] {
  const openFirst = (a: Ticket, b: Ticket) =>
    STATUS_COLUMNS.indexOf(a.status) - STATUS_COLUMNS.indexOf(b.status);

  if (groupBy === 'priority') {
    return PRIORITY_ORDER.map((p) => ({
      key: p, label: p, color: PRIORITY_COLOR[p],
      tickets: tickets.filter((t) => t.priority === p).sort(openFirst),
    })).filter((l) => l.tickets.length > 0);
  }
  if (groupBy === 'assignee') {
    const byId = new Map<string, Lane>();
    for (const t of tickets) {
      const key = t.assigneeDisplay ?? 'Unassigned';
      if (!byId.has(key)) byId.set(key, { key, label: key, tickets: [] });
      byId.get(key)!.tickets.push(t);
    }
    return [...byId.values()].map((l) => ({ ...l, tickets: l.tickets.sort(openFirst) }))
      .sort((a, b) => (a.label === 'Unassigned' ? 1 : b.label === 'Unassigned' ? -1 : b.tickets.length - a.tickets.length));
  }
  if (groupBy === 'type') {
    const byType = new Map<string, Lane>();
    for (const t of tickets) {
      if (!byType.has(t.type)) byType.set(t.type, { key: t.type, label: t.type, tickets: [] });
      byType.get(t.type)!.tickets.push(t);
    }
    return [...byType.values()].map((l) => ({ ...l, tickets: l.tickets.sort(openFirst) }));
  }
  // epic
  const byEpic = new Map<string, Lane>();
  for (const t of tickets) {
    const key = t.parent ? `${t.parent.displayId} — ${t.parent.title}` : (t.type === 'Epic' ? `${t.displayId} — ${t.title}` : 'No epic');
    if (!byEpic.has(key)) byEpic.set(key, { key, label: key, tickets: [] });
    byEpic.get(key)!.tickets.push(t);
  }
  return [...byEpic.values()].map((l) => ({ ...l, tickets: l.tickets.sort(openFirst) }))
    .sort((a, b) => (a.label === 'No epic' ? 1 : b.label === 'No epic' ? -1 : 0));
}
