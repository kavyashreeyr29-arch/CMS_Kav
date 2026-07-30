import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Clock, Flame, Gauge, Ticket as TicketIcon,
  TrendingUp, Users as UsersIcon,
} from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { projectsApi } from '../api/projects';
import { usersApi } from '../api/users';
import { analyticsApi, TrendResponse } from '../api/analytics';
import { slaPoliciesApi, SlaPolicyRow } from '../api/slaPolicies';
import { api } from '../api/client';
import { KpiCard } from '../components/ui/KpiCard';
import { PRIORITY_COLOR } from '../components/ui/Chips';
import { LabelBreakdown } from '../components/dashboard/LabelBreakdown';
import { ActivityEntry, Ticket } from '../types/ticket';
import { Project } from '../types/project';
import { ProjectFilterContext } from '../components/layout/AppShell';

const OPEN_STATUSES = ['RequirementGathering', 'CommercialApproval', 'RequirementApproval', 'ManagerApproval', 'Open', 'Assigned', 'InProgress', 'InReview', 'QATesting', 'Reopened'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const AGING_BUCKETS = ['0-2d', '3-5d', '6-10d', '11-20d', '21d+'];
const AGING_COLORS = ['var(--aging-0)', 'var(--aging-1)', 'var(--aging-2)', 'var(--aging-3)', 'var(--aging-4)'];

// "Tech" is a catch-all for every internal delivery role (prd.md's own
// wording: "developers, QA, engineer, senior dev, junior dev, lead, manager,
// tech support") — Admin/Director don't fit any of the other five named
// categories either, so they fold into Tech rather than getting an
// unrequested 7th bucket.
const ROLE_CATEGORY: Record<string, string> = {
  client: 'Client',
  callcenter: 'Helpdesk',
  pm: 'Project Manager',
  customersuccess: 'Customer Success',
  operations: 'Operations',
};
const CATEGORY_ORDER = ['Client', 'Helpdesk', 'Project Manager', 'Customer Success', 'Operations', 'Tech'];
const CATEGORY_COLOR: Record<string, string> = {
  Client: '#5B3DE0', Helpdesk: '#2563EB', 'Project Manager': '#004053',
  'Customer Success': '#16946E', Operations: '#C87F0A', Tech: '#0EA5A5',
};

/** lld.md §4.1 — shared bucketing so dashboard/API/export always agree. */
function ageingBucket(ageDays: number): number {
  if (ageDays <= 2) return 0;
  if (ageDays <= 5) return 1;
  if (ageDays <= 10) return 2;
  if (ageDays <= 20) return 3;
  return 4;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { projectFilter, setProjectFilter } = useOutletContext<ProjectFilterContext>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userCount, setUserCount] = useState(1);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<SlaPolicyRow[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [showAllAging, setShowAllAging] = useState(false);
  const [showAllWorkload, setShowAllWorkload] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ticketsApi.list({ pageSize: 200 }),
      projectsApi.list(),
      usersApi.list(),
      api.get<ActivityEntry[]>('/activity-log/recent', { limit: 8 }).catch(() => []),
      slaPoliciesApi.list().catch(() => []),
    ])
      .then(([ticketsRes, projectsRes, usersRes, activityRes, slaRes]) => {
        setTickets(ticketsRes.data);
        setProjects(projectsRes);
        setUserCount(Math.max(1, usersRes.length));
        setActivity(activityRes);
        setSlaPolicies(slaRes);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    analyticsApi.trend(period, projectFilter !== 'ALL' ? projectFilter : undefined).then(setTrend);
  }, [period, projectFilter]);

  const scopedTickets = useMemo(
    () => (projectFilter === 'ALL' ? tickets : tickets.filter((t) => t.project?.code === projectFilter)),
    [tickets, projectFilter],
  );
  const scopedProjects = useMemo(
    () => (projectFilter === 'ALL' ? projects : projects.filter((p) => p.code === projectFilter)),
    [projects, projectFilter],
  );
  const scopedActivity = useMemo(
    () => (projectFilter === 'ALL' ? activity : activity.filter((a) => a.projectCode === projectFilter)),
    [activity, projectFilter],
  );

  const stats = useMemo(() => {
    const tickets = scopedTickets;
    const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
    const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
    const dueToday = open.filter((t) => t.dueDate && sameDay(new Date(t.dueDate), new Date()));
    const highPriority = open.filter((t) => t.priority === 'Critical' || t.priority === 'High');
    const closedThisMonth = tickets.filter(
      (t) => (t.status === 'Completed' || t.status === 'Closed') && sameMonth(new Date(t.createdAt), new Date()),
    );
    const closed = tickets.filter((t) => t.status === 'Completed' || t.status === 'Closed');
    const avgResolutionDays = closed.length
      ? Math.round(closed.reduce((s, t) => s + daysBetween(t.createdAt, t.updatedAt), 0) / closed.length)
      : 0;
    const slaCompliance = closed.length
      ? Math.round((closed.filter((t) => !t.slaBreached).length / closed.length) * 100)
      : 100;
    // Mirrors the reference prototype's capacityUsed heuristic: total
    // estimated hours on open work vs. a flat 40h/week per person.
    const capacityUsed = Math.min(100, Math.round(
      (open.reduce((s, t) => s + (t.estimatedHours ?? 0), 0) / (userCount * 40)) * 100,
    ));

    return { open, overdue, dueToday, highPriority, closedThisMonth, avgResolutionDays, slaCompliance, capacityUsed };
  }, [scopedTickets, userCount]);

  // Who's actually filing tickets, by role category — Client / Helpdesk
  // (Call Center) / Project Manager / Customer Success / Operations / Tech
  // (every internal delivery role: dev, QA, lead, admin, etc.).
  const raisedByRole = useMemo(() => {
    const counts = new Map(CATEGORY_ORDER.map((c) => [c, 0]));
    for (const t of scopedTickets) {
      const category = (t.reporter?.baseRoleId && ROLE_CATEGORY[t.reporter.baseRoleId]) || 'Tech';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return CATEGORY_ORDER.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [scopedTickets]);

  // Best-matching SLA policy per project (project-specific override beats
  // the org-wide default) — answers "what SLA applies here, and is it being
  // breached" right on the ageing table instead of leaving that implicit.
  const slaByProject = useMemo(() => {
    const map = new Map<string, { resolutionTargetMinutes: number } | null>();
    for (const proj of scopedProjects) {
      const candidates = slaPolicies.filter((s) => s.projectId === proj.id || s.projectId === null);
      const best = candidates.sort((a, b) => (b.projectId ? 1 : 0) - (a.projectId ? 1 : 0))[0];
      map.set(proj.code, best ? { resolutionTargetMinutes: best.resolutionTargetMinutes } : null);
    }
    return map;
  }, [slaPolicies, scopedProjects]);

  const priorityData = useMemo(
    () => PRIORITIES.map((p) => ({ name: p, value: stats.open.filter((t) => t.priority === p).length, color: PRIORITY_COLOR[p] })),
    [stats.open],
  );

  const AGING_LIMIT = 5;
  const allAgingByProject = useMemo(() => {
    // PRD Phase 2 §3.4 — bucketed by staleness (days since last touched, i.e.
    // updatedAt), not raw age since creation. A ticket worked on yesterday
    // shouldn't age identically to one silently sitting untouched for the
    // same number of days since it was raised.
    return scopedProjects.map((proj) => {
      const buckets = [0, 0, 0, 0, 0];
      let breached = 0;
      scopedTickets
        .filter((t) => t.project?.code === proj.code && OPEN_STATUSES.includes(t.status))
        .forEach((t) => {
          buckets[ageingBucket(daysBetween(t.updatedAt, new Date().toISOString()))] += 1;
          if (t.slaBreached) breached += 1;
        });
      return { proj, buckets, total: buckets.reduce((a, b) => a + b, 0), breached };
    }).sort((a, b) => b.total - a.total);
  }, [scopedTickets, scopedProjects]);
  const agingByProject = showAllAging ? allAgingByProject : allAgingByProject.slice(0, AGING_LIMIT);

  const WORKLOAD_LIMIT = 5;
  const allWorkload = useMemo(() => {
    const map = new Map<string, { name: string; hours: number }>();
    stats.open.forEach((t) => {
      const name = t.assigneeDisplay ?? 'Unassigned';
      const entry = map.get(name) ?? { name, hours: 0 };
      entry.hours += t.estimatedHours ?? 0;
      map.set(name, entry);
    });
    return [...map.values()].sort((a, b) => b.hours - a.hours);
  }, [stats.open]);
  const workload = showAllWorkload ? allWorkload : allWorkload.slice(0, WORKLOAD_LIMIT);

  // Matches WORKLOAD_LIMIT — the two panels sit side by side (row-2b), so a
  // mismatched cap (this used to be 10 against workload's 5) made the row
  // heights visibly uneven.
  const HEALTH_LIMIT = WORKLOAD_LIMIT;
  const allProjectHealth = useMemo(() => {
    return scopedProjects.map((proj) => {
      const projTickets = scopedTickets.filter((t) => t.project?.code === proj.code);
      const openCt = projTickets.filter((t) => OPEN_STATUSES.includes(t.status)).length;
      const overdueCt = projTickets.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && OPEN_STATUSES.includes(t.status)).length;
      const ratio = openCt ? overdueCt / openCt : 0;
      const health = ratio > 0.25 ? 'red' : ratio > 0.1 ? 'amber' : 'green';
      return { proj, openCt, overdueCt, health, ratio };
    }).sort((a, b) => b.ratio - a.ratio);
  }, [scopedTickets, scopedProjects]);
  const projectHealth = allProjectHealth.slice(0, HEALTH_LIMIT);

  const DUE_LIMIT = 5;
  const allUpcomingDue = useMemo(
    () => stats.open.filter((t) => t.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [stats.open],
  );
  const upcomingDue = allUpcomingDue.slice(0, DUE_LIMIT);

  const ACTIVITY_LIMIT = 5;

  if (loading) return <div className="loading-state">Loading dashboard…</div>;

  return (
    <>
      <div className="kpi-grid">
        <KpiCard icon={TicketIcon} tone="ink" label="Open tickets" value={stats.open.length} sub={`of ${scopedTickets.length} total`} />
        <KpiCard icon={Clock} tone="amber" label="Due today" value={stats.dueToday.length} />
        <KpiCard icon={AlertTriangle} tone="red" label="Overdue" value={stats.overdue.length} sub={`${stats.open.length ? Math.round((stats.overdue.length / stats.open.length) * 100) : 0}% of open`} />
        <KpiCard icon={Flame} tone="red" label="High + Critical" value={stats.highPriority.length} />
        <KpiCard icon={CheckCircle2} tone="green" label="Closed this month" value={stats.closedThisMonth.length} />
        <KpiCard icon={TrendingUp} tone="brand" label="Avg resolution" value={`${stats.avgResolutionDays}d`} />
        <KpiCard icon={Gauge} tone="green" label="SLA compliance" value={`${stats.slaCompliance}%`} />
        <KpiCard icon={UsersIcon} tone="brand" label="Team capacity used" value={`${stats.capacityUsed}%`} />
      </div>

      <div className="row row-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Open tickets by priority</div>
              <div className="panel-sub">{stats.open.length} tickets currently open</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                {priorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E3E5EF' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-row" style={{ justifyContent: 'center', marginTop: -6 }}>
            {priorityData.map((d, i) => (
              <span key={i}><span className="legend-dot" style={{ background: d.color }} />{d.name} ({d.value})</span>
            ))}
          </div>
        </div>
        <LabelBreakdown tickets={scopedTickets} limit={5} onViewAll={() => navigate('/analytics')} />
      </div>

      <div className="row">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Tickets raised by</div>
              <div className="panel-sub">Who's actually filing tickets, by role — all statuses{projectFilter !== 'ALL' ? ` — ${projectFilter} only` : ''}</div>
            </div>
          </div>
          <div className="mom-row" style={{ gridTemplateColumns: `repeat(${CATEGORY_ORDER.length}, 1fr)` }}>
            {raisedByRole.map((r) => (
              <div className="mom-stat" key={r.name}>
                <div className="mom-label" style={{ color: CATEGORY_COLOR[r.name] }}>{r.name}</div>
                <div className="mom-value">{r.count}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                  {scopedTickets.length ? Math.round((r.count / scopedTickets.length) * 100) : 0}% of total
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Trend summary</div>
              <div className="panel-sub">Created vs. closed{projectFilter === 'ALL' ? ', all projects merged' : ` — ${projectFilter} only`}</div>
            </div>
            <div className="period-toggle">
              {(['month', 'quarter', 'year'] as const).map((p) => (
                <div key={p} className={`period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                  {p[0].toUpperCase() + p.slice(1)}
                </div>
              ))}
            </div>
          </div>
          {trend && (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={trend.buckets} margin={{ left: -18, right: 8 }} barGap={4}>
                <CartesianGrid stroke="#EEF0F6" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: '#9AA1B2' }} axisLine={{ stroke: '#E3E5EF' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: '#9AA1B2' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E3E5EF' }} />
                <Bar dataKey="created" fill="#004053" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" fill="#1DB88E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="row">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Ticket ageing by project</div>
              <div className="panel-sub">Days since each open ticket was last touched (idle time), bucketed by project — click a row to see tickets aged past SLA</div>
            </div>
            <div className="legend-row">
              {AGING_BUCKETS.map((b, i) => <span key={i}><span className="legend-dot" style={{ background: AGING_COLORS[i] }} />{b}</span>)}
            </div>
            {allAgingByProject.length > AGING_LIMIT && (
              <span className="panel-link" onClick={() => setShowAllAging((v) => !v)}>
                {showAllAging ? 'Show less ←' : `View all ${allAgingByProject.length} →`}
              </span>
            )}
          </div>
          <table className="aging-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Project</th>
                {AGING_BUCKETS.map((b) => <th key={b} className="aging-cell">{b}</th>)}
                <th className="aging-cell">Total open</th>
                <th className="aging-cell" title="Open tickets past their project's SLA resolution target">SLA</th>
              </tr>
            </thead>
            <tbody>
              {agingByProject.map(({ proj, buckets, total, breached }) => {
                const sla = slaByProject.get(proj.code);
                return (
                  <tr
                    key={proj.code}
                    style={{ cursor: 'pointer' }}
                    title={`View ${proj.code} tickets aged past SLA`}
                    onClick={() => { setProjectFilter(proj.code); navigate('/tickets?slaBreached=true'); }}
                  >
                    <td><div className="aging-proj">{proj.code}</div><div className="aging-proj-sub">{proj.name}</div></td>
                    {buckets.map((c, i) => (
                      <td key={i} className="aging-cell">
                        <span className="aging-chip" style={{ background: AGING_COLORS[i], opacity: c === 0 ? 0.18 : 0.55 + Math.min(c, 10) * 0.045, color: c === 0 ? 'var(--ink-faint)' : '#fff' }}>{c}</span>
                      </td>
                    ))}
                    <td className="aging-cell aging-total">{total}</td>
                    <td className="aging-cell">
                      {sla === null ? (
                        <span style={{ fontSize: 10, color: 'var(--ink-faint)' }} title="No SLA policy configured for this project">No SLA</span>
                      ) : breached > 0 ? (
                        <span className="label-chip" style={{ background: '#FCEBEA', color: 'var(--critical)' }} title={`Target resolution: ${Math.round((sla?.resolutionTargetMinutes ?? 0) / 60)}h`}>
                          {breached} breached
                        </span>
                      ) : (
                        <span className="label-chip" style={{ background: '#E7F7F1', color: 'var(--success-dark)' }} title={`Target resolution: ${Math.round((sla?.resolutionTargetMinutes ?? 0) / 60)}h`}>
                          ✓ within SLA
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {agingByProject.length === 0 && <tr><td colSpan={8} className="empty-state">No projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row row-2b">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Team workload</div>
              <div className="panel-sub">Estimated hours of open, unfinished work per assignee — how full each person's plate is right now (bar fills toward a 40h/week capacity; red means over 32h, i.e. already close to or over capacity)</div>
            </div>
            {allWorkload.length > WORKLOAD_LIMIT && (
              <span className="panel-link" onClick={() => setShowAllWorkload((v) => !v)}>
                {showAllWorkload ? 'Show less ←' : `View all ${allWorkload.length} →`}
              </span>
            )}
          </div>
          {workload.map((w) => {
            const overloaded = w.hours > 32;
            return (
              <div className="wl-row" key={w.name}>
                <div className="wl-name">{w.name}</div>
                <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${Math.min(100, (w.hours / 40) * 100)}%`, background: overloaded ? 'var(--critical)' : 'var(--brand)' }} /></div>
                <div className="wl-val">{Math.round(w.hours)}h</div>
              </div>
            );
          })}
          {workload.length === 0 && <div className="empty-state">No open tickets with estimated hours yet.</div>}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div><div className="panel-title">Project health</div><div className="panel-sub">Based on share of overdue open tickets</div></div>
            {allProjectHealth.length > HEALTH_LIMIT && (
              <span className="panel-link" onClick={() => navigate('/analytics')}>View all {allProjectHealth.length} →</span>
            )}
          </div>
          {projectHealth.map(({ proj, openCt, overdueCt, health }) => (
            <div className="health-item" key={proj.code}>
              <div className={`health-dot ${health}`} />
              <div><div className="health-name">{proj.code}</div><div className="health-sub">{proj.name}</div></div>
              <div className="health-meta">{openCt} open<br />{overdueCt} overdue</div>
            </div>
          ))}
          {projectHealth.length === 0 && <div className="empty-state">No projects yet.</div>}
        </div>
      </div>

      <div className="row row-2b">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Upcoming due dates</div>
            {allUpcomingDue.length > DUE_LIMIT && (
              <span className="panel-link" onClick={() => navigate('/tickets')}>View all {allUpcomingDue.length} →</span>
            )}
          </div>
          {upcomingDue.map((t) => {
            const daysUntil = Math.round((new Date(t.dueDate!).getTime() - Date.now()) / 86400000);
            return (
              <div key={t.id} className="timeline-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                <div className="timeline-dot" style={{ background: PRIORITY_COLOR[t.priority] }} />
                <div><span className="tid">{t.displayId}</span> {t.title} <span className="activity-time">· due {new Date(t.dueDate!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ({daysUntil <= 0 ? 'overdue' : `${daysUntil}d`})</span></div>
              </div>
            );
          })}
          {upcomingDue.length === 0 && <div className="empty-state">Nothing due soon.</div>}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Recent activity</div>
            {scopedActivity.length > ACTIVITY_LIMIT && (
              <span className="panel-link" onClick={() => navigate('/comms')}>View all {scopedActivity.length} →</span>
            )}
          </div>
          {scopedActivity.slice(0, ACTIVITY_LIMIT).map((a) => (
            <div className="activity-item" key={a.id}>
              <div className="activity-avatar">{(a.actor?.name ?? '?').split(' ').map((s) => s[0]).join('').slice(0, 2)}</div>
              <div><div className="activity-text"><strong>{a.actor?.name ?? 'Someone'}</strong> {a.actionText}</div><div className="activity-time">{new Date(a.createdAt).toLocaleString()}</div></div>
            </div>
          ))}
          {scopedActivity.length === 0 && <div className="empty-state">No activity recorded yet.</div>}
        </div>
      </div>
    </>
  );
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function sameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}
