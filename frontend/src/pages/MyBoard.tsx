import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Gauge, Ticket as TicketIcon, TrendingUp } from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { useAuth } from '../auth/AuthContext';
import { KpiCard } from '../components/ui/KpiCard';
import { StatusDot, formatStatus } from '../components/ui/Chips';
import { LabelBreakdown } from '../components/dashboard/LabelBreakdown';
import { Ticket } from '../types/ticket';

// prd.md §8.3 — personal "My tickets summary" for field-team roles
// (Call Center / Customer Success / Operations). Scoping to "raised by me"
// happens server-side via the reporter/source scope filter already applied
// to /tickets; this page just presents the counts.
export function MyBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketsApi.list({ pageSize: 200 }).then((res) => setTickets(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-state">Loading…</div>;

  const open = tickets.filter((t) => ['RequirementGathering', 'CommercialApproval', 'RequirementApproval', 'ManagerApproval', 'Open', 'Assigned', 'Reopened'].includes(t.status));
  const inProgress = tickets.filter((t) => ['InProgress', 'InReview', 'QATesting'].includes(t.status));
  const closed = tickets.filter((t) => ['Completed', 'Closed'].includes(t.status));

  return (
    <>
      <div className="restricted-banner">
        <Gauge size={14} />
        Personal summary for <strong style={{ margin: '0 4px' }}>{user?.name}</strong> — counts only the tickets you raised.
      </div>
      <div className="kpi-grid cols-4">
        <KpiCard icon={TicketIcon} tone="brand" label="Raised by me" value={tickets.length} />
        <KpiCard icon={Clock} tone="amber" label="Open / pending" value={open.length} />
        <KpiCard icon={TrendingUp} tone="ink" label="In progress" value={inProgress.length} />
        <KpiCard icon={CheckCircle2} tone="green" label="Closed" value={closed.length} />
      </div>
      <div className="row">
        <LabelBreakdown tickets={tickets} title="My tickets by issue category" sub="Helps spot which problem types you raise most often" />
      </div>
      <div className="panel">
        <div className="panel-head"><div className="panel-title">My recent tickets</div></div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 0 }}>
            <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Raised</th></tr></thead>
            <tbody>
              {tickets.slice(0, 15).map((t) => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/tickets/${t.id}`)}>
                  <td className="tid">{t.displayId}</td>
                  <td>{t.title}</td>
                  <td><span className="status-chip"><StatusDot status={t.status} />{formatStatus(t.status)}</span></td>
                  <td className="mono">{new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={4} className="empty-state">No tickets raised yet — use "New ticket" to raise your first one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
