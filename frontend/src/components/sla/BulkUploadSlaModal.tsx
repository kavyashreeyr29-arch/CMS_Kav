import { useRef, useState } from 'react';
import { CheckCircle2, Upload, X, XCircle } from 'lucide-react';
import { slaPoliciesApi, BulkUploadResult } from '../../api/slaPolicies';

interface Props {
  onClose: () => void;
  onCommitted: () => void;
}

// prd.md §9 — bulk CSV upload with a validation/preview step before
// committing. Expected columns: priority,project,client,responseTarget,
// resolutionTarget (project/client optional — omit for an org-wide,
// priority-only rule).
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

function toRows(parsed: Record<string, string>[]) {
  return parsed.map((r) => ({
    priority: r.priority || undefined,
    project: r.project || undefined,
    client: r.client || undefined,
    responseTarget: r.responseTarget ? Number(r.responseTarget) : undefined,
    resolutionTarget: r.resolutionTarget ? Number(r.resolutionTarget) : undefined,
  }));
}

export function BulkUploadSlaModal({ onClose, onCommitted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ReturnType<typeof toRows>>([]);
  const [preview, setPreview] = useState<BulkUploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    const text = await file.text();
    const parsedRows = toRows(parseCsv(text));
    setRows(parsedRows);
    setBusy(true);
    try {
      const result = await slaPoliciesApi.bulkUpload(parsedRows, false);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not validate the file.');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError('');
    try {
      await slaPoliciesApi.bulkUpload(rows, true);
      onCommitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the policies.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Import SLA policies from CSV</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 12 }}>
            Columns: <code>priority,project,client,responseTarget,resolutionTarget</code> (minutes) — project
            and client are optional; leave blank for an org-wide, priority-only rule.
          </div>
          {!preview && (
            <div className="dropzone" onClick={() => inputRef.current?.click()}>
              <Upload size={16} />
              <span>{busy ? 'Validating…' : 'Click to choose a .csv file'}</span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
            </div>
          )}
          {preview && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                {preview.validCount ?? 0} of {preview.total} rows valid
              </div>
              <div className="table-scroll" style={{ maxHeight: 260 }}>
                <table className="data-table">
                  <thead><tr><th>Row</th><th>Priority</th><th>Project</th><th>Client</th><th>Errors</th></tr></thead>
                  <tbody>
                    {preview.results.map((r) => (
                      <tr key={r.row}>
                        <td className="mono">{r.row}</td>
                        <td>{String(r.input.priority ?? '')}</td>
                        <td>{String(r.input.project ?? '')}</td>
                        <td>{String(r.input.client ?? '')}</td>
                        <td>
                          {r.valid ? (
                            <CheckCircle2 size={13} color="#16946E" />
                          ) : (
                            <span style={{ color: 'var(--critical)', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <XCircle size={13} />{r.errors.join('; ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error && <div className="field-error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          {preview && (
            <button className="btn-primary" onClick={commit} disabled={busy || (preview.validCount ?? 0) === 0}>
              {busy ? 'Importing…' : `Import ${preview.validCount ?? 0} polic${(preview.validCount ?? 0) === 1 ? 'y' : 'ies'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
