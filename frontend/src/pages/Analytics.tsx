import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsApi, ProductivityResponse, ProjectWiseRow, TrendResponse } from '../api/analytics';
import { ticketsApi } from '../api/tickets';
import { campaignsApi, CampaignTicketSummaryRow } from '../api/campaigns';
import { LabelBreakdown } from '../components/dashboard/LabelBreakdown';
import { exportToCsv } from '../components/ui/exportCsv';
import { useAuth } from '../auth/AuthContext';
import { Ticket, TicketStatus } from '../types/ticket';

// Mirrors backend/src/campaigns/campaigns.controller.ts's CAMPAIGN_SUMMARY_ROLES —
// "Manager" in the user's ask maps to the existing `pm` (Project Manager) role.
const CAMPAIGN_SUMMARY_ROLES = ['admin', 'director', 'lead', 'pm', 'customersuccess'];

const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITY_COLOR: Record<string, string> = { Critical: '#E2483B', High: '#F5A524', Medium: '#3B6CF4', Low: '#5B6472' };
const CLIENT_ROWS_LIMIT = 10;

// Mirrors Backlog.tsx's requirement-to-deployment stage mapping — applied
// here org-wide across every ticket type (not just Epic/Story) for a
// company-wide "where is our work stuck" view, the CEO-level ask
// (CHANGELOG.md) that Backlog's per-project roadmap doesn't answer on its
// own.
const STAGE_ORDER = ['Planning', 'Development', 'Testing', 'Deployed'] as const;
type Stage = (typeof STAGE_ORDER)[number];
const STAGE_COLOR: Record<Stage, string> = { Planning: '#7C8598', Development: '#F5A524', Testing: '#3B6CF4', Deployed: '#1DB88E' };
const STATUS_TO_STAGE: Record<TicketStatus, Stage> = {
  Open: 'Planning', Assigned: 'Planning',
  InProgress: 'Development', Reopened: 'Development',
  InReview: 'Testing', QATesting: 'Testing',
  Completed: 'Deployed', Closed: 'Deployed',
};

type PeriodPreset = 'month' | 'quarter' | 'year' | 'custom';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  return isoDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

// prd.md §8.2 — Admin/leadership deep-reporting view. Every panel below is
// scoped to the period filter at the top (month/quarter/year/custom range,
// CHANGELOG.md "all information under analytics should have filters") —
// deliberately distinct from Dashboard.tsx's "operational pulse", which has
// no period control and always shows current-state snapshots.
export function Analytics() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProjectWiseRow[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [productivity, setProductivity] = useState<ProductivityResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [campaignSummary, setCampaignSummary] = useState<CampaignTicketSummaryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const canSeeCampaignSummary = !!user && CAMPAIGN_SUMMARY_ROLES.includes(user.role.id);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));

  // The period preset drives both the trend bucket granularity (server
  // side, analyticsApi.trend) and the from/to window every other panel
  // filters its already-fetched tickets by (client side) — one control,
  // every panel agrees on what "this period" means.
  const range = useMemo(() => {
    if (periodPreset === 'custom') return { from: customFrom, to: customTo };
    const days = periodPreset === 'month' ? 30 : periodPreset === 'quarter' ? 90 : 365;
    return { from: daysAgo(days), to: isoDate(new Date()) };
  }, [periodPreset, customFrom, customTo]);

  const sinceDays = useMemo(() => {
    const ms = new Date(`${range.to}T23:59:59Z`).getTime() - new Date(`${range.from}T00:00:00Z`).getTime();
    return Math.max(1, Math.ceil(ms / 86400000));
  }, [range]);

  useEffect(() => {
    Promise.all([analyticsApi.projectWise(), ticketsApi.list({ pageSize: 500 })])
      .then(([projectWise, ticketsRes]) => {
        setRows(projectWise);
        setTickets(ticketsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    analyticsApi.productivity(sinceDays).then(setProductivity);
  }, [sinceDays]);

  useEffect(() => {
    analyticsApi.trend(periodPreset === 'custom' ? 'month' : periodPreset).then(setTrend);
  }, [periodPreset]);

  useEffect(() => {
    if (!canSeeCampaignSummary) return;
    campaignsApi.summary().then(setCampaignSummary).catch(() => {});
  }, [canSeeCampaignSummary]);

  // Every ticket created within the selected window — the shared input for
  // the panels below that report on period activity rather than
  // current-state snapshots (LabelBreakdown/Client-raised/Resolution-time
  // intentionally stay on the full ticket set, since "recurring issue
  // categories" and "resolution time" are more useful unscoped by a
  // reporting window — see their panel-sub copy).
  const ticketsInRange = useMemo(() => {
    const from = new Date(`${range.from}T00:00:00Z`).getTime();
    const to = new Date(`${range.to}T23:59:59Z`).getTime();
    return tickets.filter((t) => {
      const created = new Date(t.createdAt).getTime();
      return created >= from && created <= to;
    });
  }, [tickets, range]);

  const headline = useMemo(() => {
    const closed = ticketsInRange.filter((t) => t.status === 'Completed' || t.status === 'Closed');
    const slaEligible = closed.length;
    const slaCompliant = closed.filter((t) => !t.slaBreached).length;
    return {
      total: ticketsInRange.length,
      closed: closed.length,
      slaCompliance: slaEligible ? Math.round((slaCompliant / slaEligible) * 100) : 100,
    };
  }, [ticketsInRange]);

  const funnel = useMemo(() => {
    const counts: Record<Stage, number> = { Planning: 0, Development: 0, Testing: 0, Deployed: 0 };
    for (const t of tickets) counts[STATUS_TO_STAGE[t.status]] += 1;
    return STAGE_ORDER.map((stage) => ({ stage, count: counts[stage] }));
  }, [tickets]);

  const clientRows = useMemo(
    () => rows.filter((r) => r.clientTotal > 0).sort((a, b) => b.clientTotal - a.clientTotal).slice(0, CLIENT_ROWS_LIMIT),
    [rows],
  );

  const resolutionByPriority = useMemo(() => {
    const buckets = new Map<string, { totalDays: number; count: number }>();
    for (const t of tickets) {
      if (t.status !== 'Completed' && t.status !== 'Closed') continue;
      const days = (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000;
      if (days < 0) continue;
      const b = buckets.get(t.priority) ?? { totalDays: 0, count: 0 };
      b.totalDays += days;
      b.count += 1;
      buckets.set(t.priority, b);
    }
    return PRIORITY_ORDER.map((priority) => {
      const b = buckets.get(priority);
      return { priority, avgDays: b ? Math.round((b.totalDays / b.count) * 10) / 10 : 0, count: b?.count ?? 0 };
    });
  }, [tickets]);

  const trendWithNet = useMemo(
    () => trend?.buckets.map((b) => ({ ...b, net: b.created - b.closed })) ?? [],
    [trend],
  );

  // "How many tickets raised against campaign, month/quarter/year" — reuses
  // the same period selector every other panel on this page respects,
  // rather than a separate three-way breakdown control.
  const campaignSummaryInRange = useMemo(() => {
    if (!campaignSummary) return [];
    const from = new Date(`${range.from}T00:00:00Z`).getTime();
    const to = new Date(`${range.to}T23:59:59Z`).getTime();
    const counts = new Map<string, number>();
    for (const row of campaignSummary) {
      const created = new Date(row.createdAt).getTime();
      if (created < from || created > to) continue;
      counts.set(row.campaignName, (counts.get(row.campaignName) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [campaignSummary, range]);
  const campaignSummaryTotal = campaignSummaryInRange.reduce((sum, r) => sum + r.count, 0);

  if (loading) return <div className="loading-state">Loading analytics…</div>;

  function exportProjectWise() {
    exportToCsv(
      'project-wise-performance',
      ['Project', 'Name', 'Total', 'Open', 'Closed', 'Avg age (open)', 'Hours spent', 'Client-raised', 'Client open', 'Client closed'],
      rows.map((r) => [r.projectCode, r.projectName, r.total, r.open, r.closed, r.avgAgeDays, r.hoursSpent, r.clientTotal, r.clientOpen, r.clientClosed]),
    );
  }

  return (
    <>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">Reporting period</div>
            <div className="panel-sub">Drives the headline numbers, performance trend, and productivity panels below</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="period-toggle">
              {(['month', 'quarter', 'year'] as const).map((p) => (
                <div key={p} className={`period-btn ${periodPreset === p ? 'active' : ''}`} onClick={() => setPeriodPreset(p)}>
                  {p[0].toUpperCase() + p.slice(1)}
                </div>
              ))}
              <div className={`period-btn ${periodPreset === 'custom' ? 'active' : ''}`} onClick={() => setPeriodPreset('custom')}>
                Custom
              </div>
            </div>
            {periodPreset === 'custom' && (
              <>
                <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="From date" />
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>to</span>
                <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="To date" />
              </>
            )}
          </div>
        </div>
        <div className="mom-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="mom-stat"><div className="mom-label">Tickets raised</div><div className="mom-value">{headline.total}</div></div>
          <div className="mom-stat"><div className="mom-label">Closed</div><div className="mom-value">{headline.closed}</div></div>
          <div className="mom-stat"><div className="mom-label">SLA compliance</div><div className="mom-value">{headline.slaCompliance}%</div></div>
        </div>
      </div>

      {canSeeCampaignSummary && campaignSummary && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">Campaign & promotion tickets</div>
              <div className="panel-sub">Tickets raised against a tracked campaign, for the selected period — {campaignSummaryTotal} total</div>
            </div>
          </div>
          {campaignSummaryInRange.length === 0 ? (
            <div className="empty-state">No tickets linked to a campaign in this period.</div>
          ) : (
            campaignSummaryInRange.map((c) => (
              <div className="wl-row" key={c.name}>
                <div className="wl-name">{c.name}</div>
                <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${campaignSummaryInRange[0].count ? (c.count / campaignSummaryInRange[0].count) * 100 : 0}%` }} /></div>
                <div className="wl-val">{c.count} ticket{c.count !== 1 ? 's' : ''}</div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Performance trend</div>
              <div className="panel-sub">Created vs. closed vs. net backlog change, all projects merged — bucketed by {periodPreset === 'custom' ? 'month' : periodPreset}</div>
            </div>
          </div>
          {trend && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendWithNet} margin={{ left: -18, right: 8 }} barGap={4}>
                <CartesianGrid stroke="#EEF0F6" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: '#9AA1B2' }} axisLine={{ stroke: '#E3E5EF' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: '#9AA1B2' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E3E5EF' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="created" name="Created" fill="#004053" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" name="Closed" fill="#1DB88E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net change" fill="#F5A524" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="row row-2" style={{ marginBottom: 12 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Delivery funnel</div>
              <div className="panel-sub">Every ticket org-wide, by pipeline stage — where work is concentrated right now</div>
            </div>
          </div>
          <div className="mom-row" style={{ gridTemplateColumns: `repeat(${STAGE_ORDER.length}, 1fr)`, marginBottom: 10 }}>
            {funnel.map((f) => (
              <div className="mom-stat" key={f.stage}>
                <div className="mom-label" style={{ color: STAGE_COLOR[f.stage] }}>{f.stage}</div>
                <div className="mom-value">{f.count}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
            {funnel.map((f) => (
              <div key={f.stage} style={{ flex: f.count || 0.0001, background: STAGE_COLOR[f.stage] }} title={`${f.stage}: ${f.count}`} />
            ))}
          </div>
        </div>
        <LabelBreakdown tickets={tickets} sub="Where tickets are coming from, across all projects — full breakdown" />
      </div>

      <div className="row row-2" style={{ marginBottom: 12 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Client-raised tickets by project</div>
              <div className="panel-sub">Source = Client Portal, top {CLIENT_ROWS_LIMIT} projects by volume</div>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Project</th><th>Total</th><th>Open</th><th>Closed</th></tr>
            </thead>
            <tbody>
              {clientRows.map((r) => (
                <tr key={r.projectCode}>
                  <td>{r.projectCode} <span style={{ color: 'var(--ink-faint)' }}>— {r.projectName}</span></td>
                  <td className="mono">{r.clientTotal}</td>
                  <td className="mono">{r.clientOpen}</td>
                  <td className="mono">{r.clientClosed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clientRows.length === 0 && <div className="empty-state">No client-raised tickets yet.</div>}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Resolution time by priority</div>
              <div className="panel-sub">Average days from creation to close, completed/closed tickets only</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={resolutionByPriority} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke="#EEF0F6" vertical={false} />
              <XAxis dataKey="priority" tick={{ fontSize: 10.5, fill: '#9AA1B2' }} axisLine={{ stroke: '#E3E5EF' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: '#9AA1B2' }} axisLine={false} tickLine={false} unit="d" />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E3E5EF' }}
                formatter={(value: number, _name, item) => [`${value}d avg (${item.payload.count} ticket${item.payload.count !== 1 ? 's' : ''})`, 'Resolution time']}
              />
              <Bar dataKey="avgDays" radius={[4, 4, 0, 0]}>
                {resolutionByPriority.map((r) => (
                  <Cell key={r.priority} fill={PRIORITY_COLOR[r.priority]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {productivity && (
        <div className="row row-2" style={{ marginBottom: 12 }}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Developer productivity</div>
                <div className="panel-sub">Hours logged and distinct tickets worked, last {productivity.sinceDays} days · {productivity.totalHours}h total</div>
              </div>
            </div>
            {productivity.perDeveloper.map((d) => (
              <div className="wl-row" key={d.userId}>
                <div className="wl-name">{d.name}</div>
                <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${productivity.perDeveloper[0]?.hours ? (d.hours / productivity.perDeveloper[0].hours) * 100 : 0}%` }} /></div>
                <div className="wl-val">{d.hours}h · {d.ticketCount} ticket{d.ticketCount !== 1 ? 's' : ''}</div>
              </div>
            ))}
            {productivity.perDeveloper.length === 0 && <div className="empty-state">No time logged in this window yet.</div>}
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Hours by business category</div>
                <div className="panel-sub">Where time is going across InnovateX / ElevatozX / AccquareX</div>
              </div>
            </div>
            {productivity.businessCategoryBreakdown.map((c) => (
              <div className="wl-row" key={c.category}>
                <div className="wl-name">{c.category}</div>
                <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${productivity.businessCategoryBreakdown[0]?.hours ? (c.hours / productivity.businessCategoryBreakdown[0].hours) * 100 : 0}%` }} /></div>
                <div className="wl-val">{c.hours}h · {c.ticketCount} ticket{c.ticketCount !== 1 ? 's' : ''}</div>
              </div>
            ))}
            {productivity.businessCategoryBreakdown.length === 0 && <div className="empty-state">No time logged in this window yet.</div>}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Project-wise performance</div>
            <div className="panel-sub">Total, open, closed, ageing, hours spent, and the client-raised slice — under each project</div>
          </div>
          <button className="btn-ghost" onClick={exportProjectWise} disabled={rows.length === 0}><Download size={13} />CSV</button>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th>Project</th><th>Total</th><th>Open</th><th>Closed</th><th>Avg age (open)</th><th>Hours spent</th>
                <th>Client-raised</th><th>Client open</th><th>Client closed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectCode}>
                  <td>{r.projectCode} <span style={{ color: 'var(--ink-faint)' }}>— {r.projectName}</span></td>
                  <td className="mono">{r.total}</td>
                  <td className="mono">{r.open}</td>
                  <td className="mono">{r.closed}</td>
                  <td className="mono">{r.avgAgeDays}d</td>
                  <td className="mono">{r.hoursSpent}h</td>
                  <td className="mono">{r.clientTotal}</td>
                  <td className="mono">{r.clientOpen}</td>
                  <td className="mono">{r.clientClosed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
