import { useEffect, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { labelsApi, LabelRow } from '../api/labels';
import { LabelChip } from '../components/ui/Chips';
import { exportToCsv } from '../components/ui/exportCsv';

export function Labels() {
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    labelsApi.list().then(setLabels).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit() {
    if (!draft.trim()) return;
    await labelsApi.create(draft.trim());
    setDraft('');
    load();
  }
  async function remove(id: string) {
    await labelsApi.remove(id);
    load();
  }
  function exportLabels() {
    exportToCsv('labels', ['Label', 'Tickets'], labels.map((l) => [l.name, l._count.tickets]));
  }

  if (loading) return <div className="loading-state">Loading labels…</div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Issue labels / categories</div>
          <div className="panel-sub">Used when raising a ticket, and rolled up in the recurring-issue reports</div>
        </div>
        <button className="btn-ghost" onClick={exportLabels} disabled={labels.length === 0}><Download size={13} />CSV</button>
      </div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="select-pill"
          style={{ minWidth: 220, border: '1px solid var(--border)' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Shipping Delay"
        />
        <button className="btn-primary" onClick={submit}><Plus size={14} />Add label</button>
      </div>
      <div>
        {labels.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
            <LabelChip l={l.name} />
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginLeft: 'auto' }}>
              {l._count.tickets} ticket{l._count.tickets === 1 ? '' : 's'}
            </span>
            <button className="btn-destructive" style={{ padding: 4 }} onClick={() => remove(l.id)} title="Remove label">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {labels.length === 0 && <div className="empty-state">No labels yet — add one above.</div>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 12 }}>
        Removing a label only takes it out of the picker for new tickets — tickets already using it keep their label for historical reporting.
      </div>
    </div>
  );
}
