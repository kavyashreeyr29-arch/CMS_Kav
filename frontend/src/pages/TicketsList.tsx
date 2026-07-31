import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Download, Lock, Paperclip, RotateCcw, ShieldCheck, Ticket as TicketIcon } from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { approvalsApi } from '../api/approvals';
import { useAuth } from '../auth/AuthContext';
import { PrioChip, SourceChip, StatusDot, LabelChip, formatStatus, formatSource } from '../components/ui/Chips';
import { SlaBadge } from '../components/ui/SlaBadge';
import { KpiCard } from '../components/ui/KpiCard';
import { formatDuration } from '../components/ui/formatDuration';
import { exportToCsv } from '../components/ui/exportCsv';
import { MyApprovalRequest, Ticket } from '../types/ticket';
import { ProjectFilterContext } from '../components/layout/AppShell';

const STATUSES = [
  'RequirementGathering', 'CommercialApproval', 'RequirementApproval', 'ManagerApproval',
  'Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Completed', 'Closed', 'Reopened',
];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const SOURCES = ['InternalPM', 'CallCenter', 'CustomerSuccess', 'Operations', 'ClientPortal', 'Sales'];
const OPEN_STATUSES = ['RequirementGathering', 'CommercialApproval', 'RequirementApproval', 'ManagerApproval', 'Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Reopened'];

function daysSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function TicketsList() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const { projectFilter } = useOutletContext<ProjectFilterContext>();
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<MyApprovalRequest[]>([]);

  const status = params.get('status') ?? 'ALL';
  const priority = params.get('priority') ?? 'ALL';
  const source = params.get('source') ?? 'ALL';
  // Set by the Dashboard's ageing-heatmap drill-down (docs/prd-phase2.md
  // §6.1) — "view tickets aged past their SLA" for a project.
  const slaBreachedOnly = params.get('slaBreached') === 'true';
  // Developer/QA base roles default to "My Tasks" (prd.md §5); explicit
  // ?view=all opts out. Full-access non-delivery roles (Admin/Director/PM)
  // just see everything by default since "My Tasks" isn't meaningful to them.
  const view = (params.get('view') as 'mine' | 'all' | null) ?? 'all';

  useEffect(() => {
    if (!permissions) return;
    setLoading(true);
    ticketsApi
      .list({
        project: projectFilter === 'ALL' ? undefined : projectFilter,
        status: status === 'ALL' ? undefined : status,
        priority: priority === 'ALL' ? undefined : priority,
        source: permissions.scope === 'all' && source !== 'ALL' ? source : undefined,
        slaBreached: slaBreachedOnly ? 'true' : undefined,
        view,
        // Reporter-scope (client) KPI cards below are derived client-side
        // from this page — a client's own ticket count is small enough that
        // a much higher cap keeps those counts accurate instead of silently
        // truncating at the org-wide default of 100.
        pageSize: permissions.scope === 'reporter' ? 1000 : 100,
      })
      .then((res) => {
        setTickets(res.data);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [status, priority, source, slaBreachedOnly, view, permissions, projectFilter]);

  // A ticket being assigned to someone doesn't mean an approval on it is
  // theirs to decide (the ATLAS payment-gateway ticket is assigned to a
  // developer while its Commercial Approval sits with a Director) — so "My
  // Tasks" needs its own pending-approvals list, not just assigneeUserId=me.
  useEffect(() => {
    if (view !== 'mine') { setPendingApprovals([]); return; }
    approvalsApi.listMine().then(setPendingApprovals);
  }, [view]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === 'ALL' || !value) next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  const showMyTasksToggle = permissions?.scope === 'all';
  const showTimeLogged = permissions?.scope === 'all' || !!permissions?.timeTracking;

  function exportCsv() {
    const columns = ['ID', 'Title', 'Source', 'Priority', 'Status', 'Assignee', 'Created', 'Started', 'Due', 'Closed', 'Age (d)', 'Idle (d)'];
    if (showTimeLogged) columns.push('Time logged');
    exportToCsv(
      'tickets',
      columns,
      tickets.map((t) => {
        const row: unknown[] = [
          t.displayId, t.title, formatSource(t.source), t.priority, formatStatus(t.status), t.assigneeDisplay ?? '',
          t.createdAt, t.actualStartAt ?? '', t.dueDate ?? '', t.closedAt ?? '', daysSince(t.createdAt), daysSince(t.updatedAt),
        ];
        if (showTimeLogged) row.push(formatDuration(t.totalLoggedMinutes));
        return row;
      }),
    );
  }

  const clientStats = useMemo(() => {
    if (permissions?.scope !== 'reporter') return null;
    return {
      // Server-side count, not tickets.length — accurate even if this
      // client somehow has more tickets than the fetched page.
      total,
      open: tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
      closed: tickets.filter((t) => !OPEN_STATUSES.includes(t.status)).length,
      reopened: tickets.filter((t) => t.status === 'Reopened').length,
    };
  }, [tickets, total, permissions]);

  const banner = useMemo(() => {
    if (!permissions || permissions.scope === 'all') return null;
    if (permissions.scope === 'source') {
      return "You're viewing tickets raised via your team's source channel — you can raise tickets, comment, take updates, and close them.";
    }
    if (permissions.scope === 'team') {
      // Unlike 'reporter' scope, assignee identity is NOT redacted for a
      // team-scoped Lead (backend/src/common/permissions/ticket-scope.ts
      // only redacts for 'reporter') — this used to fall through to the
      // Client-style message below and claim otherwise. Found via a full
      // role-permission sweep, see CHANGELOG.
      return "You're viewing tickets for the team(s) you lead.";
    }
    return "You're viewing only tickets you raised. The assignee is shown by department, and closed tickets can be reopened if the issue isn't resolved.";
  }, [permissions]);

  if (!permissions) return null;

  return (
    <>
      {clientStats && (
        <div className="kpi-grid cols-4" style={{ marginBottom: 14 }}>
          <KpiCard icon={TicketIcon} tone="brand" label="Tickets raised" value={clientStats.total} />
          <KpiCard icon={Clock} tone="amber" label="Open" value={clientStats.open} />
          <KpiCard icon={CheckCircle2} tone="green" label="Closed" value={clientStats.closed} />
          <KpiCard icon={RotateCcw} tone="red" label="Reopened" value={clientStats.reopened} />
        </div>
      )}
      {banner && (
        <div className="restricted-banner">
          <Lock size={14} />
          {banner}
        </div>
      )}
      {slaBreachedOnly && (
        <div className="restricted-banner">
          <AlertTriangle size={14} />
          Showing only tickets that have breached their SLA target.
          <span className="select-pill" style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setParam('slaBreached', '')}>Clear</span>
        </div>
      )}
      {view === 'mine' && pendingApprovals.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }} data-testid="my-pending-approvals">
          <div className="td-section-title"><ShieldCheck size={13} />Pending your approval ({pendingApprovals.length})</div>
          <div className="approval-list">
            {pendingApprovals.map((r) => (
              <div className="approval-row clickable" key={r.id} onClick={() => navigate(`/tickets/${r.ticket.id}`)}>
                <div className="approval-row-icon" style={{ background: '#FDF1DC', color: '#9A6700' }}><Clock size={14} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="approval-row-top">
                    <span className="approval-row-label">{r.label}</span>
                    <span className="tid">{r.ticket.displayId}</span>
                  </div>
                  <div className="approval-row-meta">{r.ticket.title} — requested by {r.requestedBy.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="filter-bar">
        <select className="select-pill" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
        <select className="select-pill" value={priority} onChange={(e) => setParam('priority', e.target.value)}>
          <option value="ALL">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {permissions.scope === 'all' && (
          <select className="select-pill" value={source} onChange={(e) => setParam('source', e.target.value)}>
            <option value="ALL">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{formatSource(s)}</option>)}
          </select>
        )}
        {showMyTasksToggle && (
          <div className="period-toggle">
            <div className={`period-btn ${view === 'mine' ? 'active' : ''}`} onClick={() => setParam('view', 'mine')}>My Tasks</div>
            <div className={`period-btn ${view === 'all' ? 'active' : ''}`} onClick={() => setParam('view', 'all')}>All Tickets</div>
          </div>
        )}
        <div className="select-pill">{total} total</div>
        <button className="btn-ghost" onClick={exportCsv} disabled={tickets.length === 0}><Download size={13} />CSV</button>
      </div>

      {loading ? (
        <div className="loading-state">Loading tickets…</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Title</th><th>Source</th><th>Priority</th><th>Status</th><th>SLA</th>
                <th>Assignee</th><th title="Day work actually began — the first timer start on this ticket">Started</th><th>Due</th><th>Age</th><th title="Days since last touched">Idle</th><th>Files</th>
                {showTimeLogged && <th>Time logged</th>}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const overdue = t.dueDate && new Date(t.dueDate) < new Date() && !['Completed', 'Closed'].includes(t.status);
                return (
                  <tr key={t.id} className={`clickable ${overdue ? 'row-overdue' : ''}`} onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td className="tid">{t.displayId}</td>
                    <td className="ticket-title-cell">
                      <div>{t.title}</div>
                      {t.description && <div className="ticket-desc-snip" title={t.description}>{t.description}</div>}
                      {t.label && <LabelChip l={t.label.name} />}
                    </td>
                    <td><SourceChip s={t.source} /></td>
                    <td><PrioChip p={t.priority} /></td>
                    <td><span className="status-chip"><StatusDot status={t.status} />{formatStatus(t.status)}</span></td>
                    <td><SlaBadge slaBreached={t.slaBreached} slaBreachRisk={t.slaBreachRisk} /></td>
                    <td>{t.assigneeDisplay ?? '—'}</td>
                    <td className="mono">
                      {t.actualStartAt ? new Date(t.actualStartAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="mono" style={{ color: overdue ? 'var(--critical)' : 'inherit' }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="mono">{daysSince(t.createdAt)}d</td>
                    <td className="mono">{daysSince(t.updatedAt)}d</td>
                    <td>{t._count?.attachments ? <span className="status-chip"><Paperclip size={11} />{t._count.attachments}</span> : '—'}</td>
                    {showTimeLogged && <td className="mono">{formatDuration(t.totalLoggedMinutes)}</td>}
                  </tr>
                );
              })}
              {tickets.length === 0 && (
                <tr><td colSpan={showTimeLogged ? 12 : 11} className="empty-state">No tickets match these filters yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
