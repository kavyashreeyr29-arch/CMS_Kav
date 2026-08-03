import { Fragment, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Clock3, Download, PenLine, Plus, Timer, Trash2 } from 'lucide-react';
import { timesheetApi, TimesheetEntry } from '../api/timesheet';
import { ticketsApi } from '../api/tickets';
import { ApiError } from '../api/client';
import { formatDuration } from '../components/ui/formatDuration';
import { exportToCsv } from '../components/ui/exportCsv';
import { KpiCard } from '../components/ui/KpiCard';

interface TicketGroup {
  ticketId: string;
  displayId: string;
  title: string;
  startDate: string;
  endDate: string;
  totalMinutes: number;
  byDay: Map<string, number>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonth(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const EMPTY_FORM = { date: today(), fromTime: '', toTime: '', taskName: '', ticketId: '' };

// "My Timesheet" (CHANGELOG.md) — a personal view combining timer-derived
// entries (grouped by ticket: start/end date, total time, day-by-day) with a
// manual-entry form for time worked without the timer running. Distinct from
// /work-hours, which is the manager/lead rollup across other people.
export function Timesheet() {
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTickets, setMyTickets] = useState<{ id: string; displayId: string; title: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  function load() {
    setLoading(true);
    timesheetApi.listMine({ startDate, endDate }).then(setEntries).finally(() => setLoading(false));
  }
  useEffect(load, [startDate, endDate]);
  useEffect(() => {
    ticketsApi.list({ view: 'mine', pageSize: 200 }).then((r) => setMyTickets(r.data.map((t) => ({ id: t.id, displayId: t.displayId, title: t.title }))));
  }, []);

  const timerGroups = useMemo(() => {
    const map = new Map<string, TicketGroup>();
    for (const e of entries) {
      if (e.source !== 'timer' || !e.ticket) continue;
      const dateStr = e.startedAt.slice(0, 10);
      const mins = Number(e.durationMinutes ?? 0);
      const g = map.get(e.ticket.id) ?? {
        ticketId: e.ticket.id, displayId: e.ticket.displayId, title: e.ticket.title,
        startDate: dateStr, endDate: dateStr, totalMinutes: 0, byDay: new Map<string, number>(),
      };
      if (dateStr < g.startDate) g.startDate = dateStr;
      if (dateStr > g.endDate) g.endDate = dateStr;
      g.totalMinutes += mins;
      g.byDay.set(dateStr, (g.byDay.get(dateStr) ?? 0) + mins);
      map.set(e.ticket.id, g);
    }
    return [...map.values()].sort((a, b) => b.endDate.localeCompare(a.endDate));
  }, [entries]);

  const manualEntries = useMemo(
    () => entries.filter((e) => e.source === 'manual').sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [entries],
  );

  const totalAutomatedMinutes = timerGroups.reduce((s, g) => s + g.totalMinutes, 0);
  const totalManualMinutes = manualEntries.reduce((s, e) => s + Number(e.durationMinutes ?? 0), 0);

  async function submitManual() {
    if (!form.date || !form.fromTime || !form.toTime || !form.taskName.trim()) {
      setError('Fill in date, task name, and both times.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await timesheetApi.createManual({
        date: form.date, fromTime: form.fromTime, toTime: form.toTime,
        taskName: form.taskName.trim(), ticketId: form.ticketId || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save entry.');
    } finally {
      setBusy(false);
    }
  }

  async function removeManual(id: string) {
    await timesheetApi.deleteManual(id);
    load();
  }

  function exportAutomated() {
    exportToCsv(
      `timesheet-automated-${startDate}-to-${endDate}`,
      ['Ticket', 'Title', 'Start date', 'End date', 'Total time'],
      timerGroups.map((g) => [g.displayId, g.title, g.startDate, g.endDate, formatDuration(g.totalMinutes)]),
    );
  }
  function exportManual() {
    exportToCsv(
      `timesheet-manual-${startDate}-to-${endDate}`,
      ['Date', 'Task', 'Ticket', 'From', 'To', 'Hours'],
      manualEntries.map((e) => [
        e.startedAt.slice(0, 10), e.taskName ?? '', e.ticket?.displayId ?? '',
        shortTime(e.startedAt), e.endedAt ? shortTime(e.endedAt) : '', formatDuration(e.durationMinutes),
      ]),
    );
  }

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="panel-title">My Timesheet</div>
          <div className="panel-sub">Time you've logged this period — automatically from ticket timers, plus anything you've filled in by hand.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="Start date" />
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} aria-label="End date" />
        </div>
      </div>

      {!loading && (
        <div className="kpi-grid cols-4" style={{ marginBottom: 14 }}>
          <KpiCard icon={Timer} tone="brand" label="Automated" value={formatDuration(totalAutomatedMinutes)} sub="from ticket timers" />
          <KpiCard icon={PenLine} tone="amber" label="Manual" value={formatDuration(totalManualMinutes)} sub="hand-entered" />
          <KpiCard icon={Clock3} tone="green" label="Total logged" value={formatDuration(totalAutomatedMinutes + totalManualMinutes)} />
          <KpiCard icon={CalendarClock} tone="ink" label="Tickets touched" value={timerGroups.length} />
        </div>
      )}

      <div className="panel" data-testid="timesheet-automated">
        <div className="panel-head">
          <div>
            <div className="panel-title">Automated — from ticket timers</div>
            <div className="panel-sub">One row per ticket you've logged time on this period — click a row for the day-by-day breakdown.</div>
          </div>
          <button className="btn-ghost" onClick={exportAutomated} disabled={timerGroups.length === 0}><Download size={13} />CSV</button>
        </div>
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Ticket</th><th>Title</th><th>Start date</th><th>End date</th><th>Total time</th><th /></tr></thead>
              <tbody>
                {timerGroups.map((g) => (
                  <Fragment key={g.ticketId}>
                    <tr className="clickable" onClick={() => setExpandedTicket(expandedTicket === g.ticketId ? null : g.ticketId)}>
                      <td className="tid">{g.displayId}</td>
                      <td>{g.title}</td>
                      <td className="mono">{shortDate(g.startDate)}</td>
                      <td className="mono">{shortDate(g.endDate)}</td>
                      <td className="mono">{formatDuration(g.totalMinutes)}</td>
                      <td>{expandedTicket === g.ticketId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                    </tr>
                    {expandedTicket === g.ticketId && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--surface-2, #FAFAFD)' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 4px' }}>
                            {[...g.byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, mins]) => (
                              <span key={date} className="label-chip">{shortDate(date)}: {formatDuration(mins)}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {timerGroups.length === 0 && <tr><td colSpan={6} className="empty-state">No timer-logged time in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 14 }} data-testid="timesheet-manual">
        <div className="panel-head">
          <div>
            <div className="panel-title">Manual entries</div>
            <div className="panel-sub">Forgot to start the timer? Log the task, date, and time range here instead.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={exportManual} disabled={manualEntries.length === 0}><Download size={13} />CSV</button>
            {!showForm && <button className="btn-primary" onClick={() => { setShowForm(true); setError(''); }}><Plus size={14} />Add entry</button>}
          </div>
        </div>

        {showForm && (
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="ts-date">Date</label>
              <input id="ts-date" type="date" max={today()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="ts-ticket">Ticket (optional)</label>
              <select
                id="ts-ticket"
                value={form.ticketId}
                onChange={(e) => {
                  const ticketId = e.target.value;
                  const picked = myTickets.find((t) => t.id === ticketId);
                  setForm((f) => ({ ...f, ticketId, taskName: picked ? picked.title : f.taskName }));
                }}
              >
                <option value="">No specific ticket</option>
                {myTickets.map((t) => <option key={t.id} value={t.id}>{t.displayId} — {t.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ts-task">Task name</label>
              <input id="ts-task" value={form.taskName} onChange={(e) => setForm((f) => ({ ...f, taskName: e.target.value }))} placeholder="e.g. Code review, standup, deployment" />
            </div>
            <div className="field">
              <label htmlFor="ts-from">From</label>
              <input id="ts-from" type="time" value={form.fromTime} onChange={(e) => setForm((f) => ({ ...f, fromTime: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="ts-to">To</label>
              <input id="ts-to" type="time" value={form.toTime} onChange={(e) => setForm((f) => ({ ...f, toTime: e.target.value }))} />
            </div>
            <div className="field" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button className="btn-primary" onClick={submitManual} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</button>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setError(''); }} disabled={busy}>Cancel</button>
            </div>
            {error && <div className="field-error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Task</th><th>Ticket</th><th>From</th><th>To</th><th>Hours</th><th /></tr></thead>
            <tbody>
              {manualEntries.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{shortDate(e.startedAt.slice(0, 10))}</td>
                  <td>{e.taskName}</td>
                  <td>{e.ticket ? <span className="tid">{e.ticket.displayId}</span> : '—'}</td>
                  <td className="mono">{shortTime(e.startedAt)}</td>
                  <td className="mono">{e.endedAt ? shortTime(e.endedAt) : '—'}</td>
                  <td className="mono">{formatDuration(e.durationMinutes)}</td>
                  <td>
                    <button className="icon-btn" onClick={() => removeManual(e.id)} title="Delete" aria-label={`Delete manual entry: ${e.taskName}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {manualEntries.length === 0 && <tr><td colSpan={7} className="empty-state">No manual entries in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
