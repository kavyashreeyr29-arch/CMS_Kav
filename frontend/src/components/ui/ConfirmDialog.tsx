import { AlertTriangle, X } from 'lucide-react';

// Shared confirm step for destructive actions (team/ticket/project delete)
// — no prior confirm-dialog pattern existed in the app (every earlier
// destructive action, e.g. label remove, fires immediately on click), but
// a hard delete with real data loss (cascading comments/attachments/PRs,
// or an entire team/project) warrants one.
export function ConfirmDialog({ title, body, confirmLabel = 'Delete', busy, error, onConfirm, onCancel }: {
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="var(--critical)" />{title}
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>{body}</p>
          {error && <div className="field-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-destructive" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
