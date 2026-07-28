import { DragEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GripVertical, Layers } from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { projectsApi } from '../api/projects';
import { PrioChip } from '../components/ui/Chips';
import { Project } from '../types/project';
import { Ticket, TicketStatus } from '../types/ticket';

// Jira-style "stage" is display-only, derived from the existing
// type+status model — no new schema. Requirement → Planning (Open/Assigned)
// → Development (InProgress/Reopened) → Testing (InReview/QATesting) →
// Deployed (Completed/Closed), the end-to-end flow PM/Dev/QA asked for.
const STAGE_ORDER = ['Planning', 'Development', 'Testing', 'Deployed'] as const;
type Stage = (typeof STAGE_ORDER)[number];
const STAGE_COLOR: Record<Stage, string> = { Planning: '#7C8598', Development: '#F5A524', Testing: '#3B6CF4', Deployed: '#1DB88E' };
const STATUS_TO_STAGE: Record<TicketStatus, Stage> = {
  Open: 'Planning', Assigned: 'Planning',
  InProgress: 'Development', Reopened: 'Development',
  InReview: 'Testing', QATesting: 'Testing',
  Completed: 'Deployed', Closed: 'Deployed',
};

// prd.md §4.1 — Backlog view: Story/Epic tickets for the current project,
// drag-to-reorder sequencing (backlogRank), separate from ticket Priority.
export function Backlog() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCode, setProjectCode] = useState('');
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.list().then((res) => {
      setProjects(res);
      if (res.length) setProjectCode(res[0].code);
    });
  }, []);

  useEffect(() => {
    if (!projectCode) return;
    setLoading(true);
    ticketsApi.list({ project: projectCode, type: 'Story,Epic', pageSize: 200 }).then((res) => setItems(res.data)).finally(() => setLoading(false));
  }, [projectCode]);

  function onDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const fromIndex = items.findIndex((i) => i.id === dragId);
    const toIndex = items.findIndex((i) => i.id === targetId);
    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setItems(reordered);
    setDragId(null);
    reordered.forEach((item, index) => {
      ticketsApi.updateBacklogRank(item.id, index).catch(() => {});
    });
  }

  // Group Stories under their parent Epic (prd.md §4.1 — "groupable by
  // Epic"). Drag-to-reorder still operates on the true flat `items` array
  // (see onDrop above) — grouping here only changes how it's rendered, not
  // the underlying backlogRank ordering.
  const { epics, storiesByEpic, ungrouped } = useMemo(() => {
    const epicList = items.filter((t) => t.type === 'Epic');
    const byEpic = new Map<string, Ticket[]>();
    const rest: Ticket[] = [];
    items
      .filter((t) => t.type === 'Story')
      .forEach((s) => {
        if (s.parentTicketId && epicList.some((e) => e.id === s.parentTicketId)) {
          const list = byEpic.get(s.parentTicketId) ?? [];
          list.push(s);
          byEpic.set(s.parentTicketId, list);
        } else {
          rest.push(s);
        }
      });
    return { epics: epicList, storiesByEpic: byEpic, ungrouped: rest };
  }, [items]);

  // Roadmap summary — every Story/Epic in the project, bucketed by stage.
  // The "swimlane" view of end-to-end progress the PM/Dev/QA tracking ask
  // was for, without a full drag-and-drop rebuild.
  const stageCounts = useMemo(() => {
    const counts: Record<Stage, number> = { Planning: 0, Development: 0, Testing: 0, Deployed: 0 };
    for (const t of items) counts[STATUS_TO_STAGE[t.status]] += 1;
    return counts;
  }, [items]);

  function epicProgress(epic: Ticket) {
    const stories = storiesByEpic.get(epic.id) ?? [];
    const done = stories.filter((s) => STATUS_TO_STAGE[s.status] === 'Deployed').length;
    const byStage: Record<Stage, number> = { Planning: 0, Development: 0, Testing: 0, Deployed: 0 };
    for (const s of stories) byStage[STATUS_TO_STAGE[s.status]] += 1;
    return { total: stories.length, done, byStage };
  }

  function row(t: Ticket) {
    return (
      <div
        key={t.id}
        className="timeline-item"
        draggable
        onDragStart={() => setDragId(t.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, t.id)}
        style={{ cursor: 'grab', alignItems: 'center', padding: '8px 4px' }}
      >
        <GripVertical size={13} color="#C4C8D6" />
        <div style={{ flex: 1 }} onClick={() => navigate(`/tickets/${t.id}`)}>
          <span className="tid">{t.displayId}</span> {t.title} <span className="activity-time">· {t.type}</span>
        </div>
        <span className="label-chip" style={{ background: `${STAGE_COLOR[STATUS_TO_STAGE[t.status]]}1a`, color: STAGE_COLOR[STATUS_TO_STAGE[t.status]] }}>
          {STATUS_TO_STAGE[t.status]}
        </span>
        <PrioChip p={t.priority} small />
      </div>
    );
  }

  return (
    <>
      <div className="filter-bar">
        <select className="select-pill" value={projectCode} onChange={(e) => setProjectCode(e.target.value)}>
          {projects.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
        </select>
        <div className="select-pill">{items.length} stories/epics</div>
      </div>

      <div className="restricted-banner" style={{ marginBottom: 12 }}>
        This is the planning view for this project's <strong>Epics</strong> (large initiatives) and the
        <strong> Stories</strong> (individual work items) under them — separate from the Tickets list, which
        shows every ticket type. Drag a row by its <GripVertical size={11} style={{ verticalAlign: -2, margin: '0 2px' }} />
        handle to change delivery order (backlog priority, independent of ticket Priority). The stage chip on
        each row tracks it end-to-end: Planning → Development → Testing → Deployed.
      </div>

      {loading ? (
        <div className="loading-state">Loading backlog…</div>
      ) : (
        <>
          {items.length > 0 && (
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="panel-head">
                <div>
                  <div className="panel-title">Roadmap — requirement to deployment</div>
                  <div className="panel-sub">Every Story/Epic in this project, by stage</div>
                </div>
              </div>
              <div className="mom-row" style={{ gridTemplateColumns: `repeat(${STAGE_ORDER.length}, 1fr)` }}>
                {STAGE_ORDER.map((stage) => (
                  <div className="mom-stat" key={stage}>
                    <div className="mom-label" style={{ color: STAGE_COLOR[stage] }}>{stage}</div>
                    <div className="mom-value">{stageCounts[stage]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="panel">
            {items.length === 0 && <div className="empty-state">No stories or epics in this project yet — use "New ticket" and pick Story or Epic.</div>}
            {epics.map((epic) => {
              const { total, done, byStage } = epicProgress(epic);
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={epic.id} style={{ marginBottom: 14 }}>
                  <div className="td-section-title" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${epic.id}`)}>
                    <Layers size={13} /><span className="tid">{epic.displayId}</span> {epic.title}
                    <span
                      className="label-chip"
                      style={{ background: `${STAGE_COLOR[STATUS_TO_STAGE[epic.status]]}1a`, color: STAGE_COLOR[STATUS_TO_STAGE[epic.status]], marginLeft: 6 }}
                    >
                      {STATUS_TO_STAGE[epic.status]}
                    </span>
                  </div>
                  {total > 0 && (
                    <div style={{ paddingLeft: 18, marginBottom: 6 }}>
                      <div className="wl-row" style={{ marginBottom: 2 }}>
                        <div className="wl-name" style={{ width: 90, fontSize: 10.5 }}>{done}/{total} done</div>
                        <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${pct}%`, background: 'var(--brand)' }} /></div>
                        <div className="wl-val">{pct}%</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {STAGE_ORDER.filter((s) => byStage[s] > 0).map((s) => (
                          <span key={s} className="label-chip" style={{ background: `${STAGE_COLOR[s]}1a`, color: STAGE_COLOR[s] }}>
                            {byStage[s]} {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ paddingLeft: 18 }}>
                    {(storiesByEpic.get(epic.id) ?? []).map(row)}
                    {!(storiesByEpic.get(epic.id) ?? []).length && (
                      <div className="empty-state" style={{ padding: '6px 4px' }}>No stories linked to this Epic yet.</div>
                    )}
                  </div>
                </div>
              );
            })}
            {ungrouped.length > 0 && (
              <div>
                {epics.length > 0 && <div className="td-section-title">Not linked to an Epic</div>}
                {ungrouped.map(row)}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
