import { useEffect, useState } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { businessCategoriesApi, BusinessCategoryRow } from '../api/businessCategories';

// Was a fixed 3-value list (InnovateX/ElevatozX/AccquareX) hardcoded in both
// the Prisma enum and every form that used it — now an admin-manageable
// list (CHANGELOG.md), same soft-delete shape as Labels but a distinct
// field on Ticket (business line, not issue categorization).
export function BusinessCategories() {
  const [categories, setCategories] = useState<BusinessCategoryRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    businessCategoriesApi.list().then(setCategories).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit() {
    if (!draft.trim()) return;
    await businessCategoriesApi.create(draft.trim());
    setDraft('');
    load();
  }
  async function remove(id: string) {
    await businessCategoriesApi.remove(id);
    load();
  }

  if (loading) return <div className="loading-state">Loading business categories…</div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Business categories</div>
          <div className="panel-sub">Which business line a ticket's work belongs to — required at creation for Customer Success, PM, and Developer roles, tracked in the Analytics hours-by-category breakdown</div>
        </div>
      </div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input
          className="select-pill"
          style={{ minWidth: 220, border: '1px solid var(--border)' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. PlatformX"
        />
        <button className="btn-primary" onClick={submit}><Plus size={14} />Add category</button>
      </div>
      <div>
        {categories.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
            <span className="label-chip" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}><Tag size={9} />{c.name}</span>
            <button className="btn-destructive" style={{ padding: 4, marginLeft: 'auto' }} onClick={() => remove(c.id)} title="Remove category">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {categories.length === 0 && <div className="empty-state">No business categories yet — add one above.</div>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 12 }}>
        Removing a category only takes it out of the picker for new tickets — tickets already using it keep it for historical reporting.
      </div>
    </div>
  );
}
