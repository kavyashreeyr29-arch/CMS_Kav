import { DragEvent, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { GripVertical, Timer } from 'lucide-react';
import { ticketsApi } from '../api/tickets';
import { PrioChip } from '../components/ui/Chips';
import { Ticket } from '../types/ticket';
import { ProjectFilterContext } from '../components/layout/AppShell';

const COLUMNS = ['Open', 'InProgress', 'InReview', 'QATesting', 'Completed'];
const COLUMN_LABELS: Record<string, string> = {
  Open: 'Open', InProgress: 'In Progress', InReview: 'In Review', QATesting: 'QA Testing', Completed: 'Completed',
};

const PRIORITY_COLOR: Record<string, string> = { Critical: '#E2483B', High: '#F5A524', Medium: '#3B6CF4', Low: '#7C8598' };

export function Kanban() {
  const navigate = useNavigate();
  const { projectFilter } = useOutletContext<ProjectFilterContext>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    ticketsApi
      .list({ project: projectFilter === 'ALL' ? undefined : projectFilter, pageSize: 200 })
      .then((res) => setTickets(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [projectFilter]);

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id);
  }

  async function onDrop(e: DragEvent, status: string) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    await ticketsApi.updateStatus(id, status);
    load();
  }

  if (loading) return <div className="loading-state">Loading board…</div>;

  return (
    <div className="kanban">
      {COLUMNS.map((col) => {
        const items = tickets.filter((t) => t.status === col);
        return (
          <div
            key={col}
            className={`kcol ${dragOverCol === col ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col) setDragOverCol(col); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => onDrop(e, col)}
          >
            <div className="kcol-head">
              <div className="kcol-title">{COLUMN_LABELS[col]}</div>
              <div className="kcol-count">{items.length}</div>
            </div>
            {items.slice(0, 20).map((t) => (
              <div
                key={t.id}
                className="kcard"
                draggable
                onDragStart={(e) => onDragStart(e, t.id)}
                onClick={() => navigate(`/tickets/${t.id}`)}
                style={{ borderLeftColor: PRIORITY_COLOR[t.priority] }}
              >
                <div className="kcard-id-row">
                  <span className="kcard-id">{t.displayId}</span>
                  <GripVertical size={11} color="#C4C8D6" />
                </div>
                <div className="kcard-title">{t.title}</div>
                {t.description && <div className="kcard-desc">{t.description}</div>}
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
            ))}
          </div>
        );
      })}
    </div>
  );
}
