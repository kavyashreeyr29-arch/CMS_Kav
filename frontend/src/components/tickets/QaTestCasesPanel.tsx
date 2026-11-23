import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Download, Paperclip, Plus, Trash2, XCircle } from 'lucide-react';
import { ticketsApi } from '../../api/tickets';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { exportToCsv } from '../ui/exportCsv';
import { TestCase, TestCaseStatus, TicketAttachment } from '../../types/ticket';

const STATUS_LABEL: Record<TestCaseStatus, string> = { pending: 'Pending', pass: 'Pass', fail: 'Fail', blocked: 'Blocked' };
const STATUS_COLOR: Record<TestCaseStatus, string> = { pending: '#7C8598', pass: '#16946E', fail: '#E2483B', blocked: '#C87F0A' };

interface Props {
  ticketId: string;
  canManage: boolean;
  evidence: TicketAttachment[];
  onEvidenceChanged: () => void;
}

// docs/prd-phase2.md §12 — QA testing module: add test cases, record
// pass/fail results, flag regressions, and attach test evidence
// (screenshots/recordings/logs) tagged separately from general attachments.
export function QaTestCasesPanel({ ticketId, canManage, evidence, onEvidenceChanged }: Props) {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', steps: '', expectedResult: '' });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    ticketsApi.testCases(ticketId).then(setCases).finally(() => setLoading(false));
  }
  useEffect(load, [ticketId]);

  async function addCase() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await ticketsApi.addTestCase(ticketId, form);
      setForm({ title: '', steps: '', expectedResult: '' });
      setShowForm(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(testCaseId: string, status: TestCaseStatus) {
    await ticketsApi.updateTestCase(ticketId, testCaseId, { status });
    load();
  }

  async function toggleRegression(testCaseId: string, regressionFlag: boolean) {
    await ticketsApi.updateTestCase(ticketId, testCaseId, { regressionFlag });
    load();
  }

  async function removeCase(testCaseId: string) {
    await ticketsApi.removeTestCase(ticketId, testCaseId);
    load();
  }

  const passCount = cases.filter((c) => c.status === 'pass').length;

  function exportCases() {
    exportToCsv(
      'qa-test-cases',
      ['Title', 'Steps', 'Expected result', 'Status', 'Regression', 'Executor', 'Executed at'],
      cases.map((c) => [c.title, c.steps ?? '', c.expectedResult ?? '', STATUS_LABEL[c.status], c.regressionFlag ? 'Yes' : 'No', c.executor?.name ?? '', c.executedAt ? new Date(c.executedAt).toLocaleString() : '']),
    );
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardList size={13} />QA testing ({cases.length}){cases.length > 0 && ` — ${passCount}/${cases.length} passing`}
        </span>
        <button className="btn-ghost" onClick={exportCases} disabled={cases.length === 0}><Download size={11} />CSV</button>
      </div>

      {loading ? (
        <div className="loading-state">Loading test cases…</div>
      ) : (
        <>
          {cases.map((c) => (
            <div key={c.id} className="timeline-item" style={{ alignItems: 'flex-start' }}>
              <div className="timeline-dot" style={{ background: STATUS_COLOR[c.status] }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{c.title}</strong>
                  {c.regressionFlag && <span className="label-chip" style={{ background: '#FCEBEA', color: 'var(--critical)' }}>Regression</span>}
                </div>
                {c.steps && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{c.steps}</div>}
                {c.expectedResult && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Expected: {c.expectedResult}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  {canManage ? (
                    <select
                      value={c.status}
                      onChange={(e) => setStatus(c.id, e.target.value as TestCaseStatus)}
                      style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6 }}
                    >
                      {(Object.keys(STATUS_LABEL) as TestCaseStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  ) : (
                    <span className="status-chip">{c.status === 'pass' ? <CheckCircle2 size={11} /> : c.status === 'fail' ? <XCircle size={11} /> : null}{STATUS_LABEL[c.status]}</span>
                  )}
                  {canManage && (
                    <label style={{ fontSize: 10.5, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={c.regressionFlag} onChange={(e) => toggleRegression(c.id, e.target.checked)} />
                      Regression
                    </label>
                  )}
                  {c.executor && c.status !== 'pending' && (
                    <span className="activity-time">by {c.executor.name}{c.executedAt ? ` · ${new Date(c.executedAt).toLocaleDateString()}` : ''}</span>
                  )}
                  {canManage && (
                    <Trash2 size={12} style={{ cursor: 'pointer', color: 'var(--ink-faint)', marginLeft: 'auto' }} onClick={() => removeCase(c.id)} />
                  )}
                </div>
              </div>
            </div>
          ))}
          {cases.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 8 }}>No test cases yet.</div>}
        </>
      )}

      {canManage && (
        showForm ? (
          <div style={{ marginTop: 8 }}>
            <div className="field full">
              <label>Test case title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Login with valid credentials" />
            </div>
            <div className="field full">
              <label>Steps</label>
              <textarea value={form.steps} onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))} rows={2} placeholder="1. …&#10;2. …" />
            </div>
            <div className="field full">
              <label>Expected result</label>
              <input value={form.expectedResult} onChange={(e) => setForm((f) => ({ ...f, expectedResult: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={addCase} disabled={busy || !form.title.trim()}>{busy ? 'Adding…' : 'Add test case'}</button>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setShowForm(true)} style={{ marginTop: 4 }}><Plus size={13} />Add test case</button>
        )
      )}

      <div style={{ marginTop: 14 }}>
        <div className="td-section-title" style={{ fontSize: 11.5 }}><Paperclip size={12} />Test evidence ({evidence.length})</div>
        <AttachmentGrid
          files={evidence}
          getDownloadUrl={(attachmentId) => ticketsApi.getAttachmentDownloadUrl(ticketId, attachmentId)}
        />
        {canManage && (
          <div style={{ marginTop: 8 }}>
            <AttachmentUploader
              label="Attach screenshots, recordings, or logs from test execution"
              requestUploadUrl={(fileName) => ticketsApi.requestAttachmentUploadUrl(ticketId, fileName)}
              onUploaded={async (meta) => { await ticketsApi.addAttachment(ticketId, { ...meta, context: 'qa' }); onEvidenceChanged(); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
