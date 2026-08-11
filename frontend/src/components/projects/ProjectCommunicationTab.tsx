import { useEffect, useState } from 'react';
import { Download, MessageSquare, Send, Trash2 } from 'lucide-react';
import { projectNotesApi, ProjectNoteRow } from '../../api/projectNotes';
import { projectsApi } from '../../api/projects';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { exportToCsv } from '../ui/exportCsv';
import { useAuth } from '../../auth/AuthContext';
import { Project } from '../../types/project';

interface Props {
  project: Project;
  onChange: () => void;
}

export function ProjectCommunicationTab({ project, onChange }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ProjectNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  function load() {
    setLoading(true);
    projectNotesApi.listForProject(project.code).then(setNotes).finally(() => setLoading(false));
  }
  useEffect(load, [project.code]);

  const commsFiles = project.documents.filter((d) => d.section === 'communication');

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await projectNotesApi.create({ projectCode: project.code, body: body.trim() });
      setBody('');
      load();
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    await projectNotesApi.remove(id);
    load();
  }

  function exportNotes() {
    exportToCsv(
      `${project.code}-message-board`,
      ['Author', 'Posted', 'Message'],
      notes.map((n) => [n.author.name, new Date(n.createdAt).toLocaleString(), n.body]),
    );
  }

  return (
    <div>
      <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MessageSquare size={13} />Message board ({notes.length})</span>
        <button className="btn-ghost" onClick={exportNotes} disabled={notes.length === 0}><Download size={12} />CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Post an update for everyone on this project…"
          style={{ flex: 1, minHeight: 56 }}
        />
        <button className="btn-primary" onClick={post} disabled={!body.trim() || posting} style={{ alignSelf: 'flex-end' }}>
          <Send size={13} />Post
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="empty-state">No updates posted yet — be the first to share something with the project team.</div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          {notes.map((n) => (
            <div key={n.id} className="note-item">
              <div className="note-head">
                <span>
                  <span className="note-author">{n.author.name}</span>{' '}
                  <span className="note-time">{new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                {(n.authorUserId === user?.id || user?.role.id === 'admin') && (
                  <button className="icon-btn" onClick={() => remove(n.id)} title="Delete" aria-label="Delete post"><Trash2 size={12} /></button>
                )}
              </div>
              <div className="note-body">{n.body}</div>
            </div>
          ))}
        </div>
      )}

      <div className="td-section-title">Shared files ({commsFiles.length})</div>
      <AttachmentGrid files={commsFiles} getDownloadUrl={(id) => projectsApi.getDocumentDownloadUrl(project.code, id)} />
      <div style={{ marginTop: 8 }}>
        <AttachmentUploader
          label="Share meeting notes, recordings, or decks"
          requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
          onUploaded={async (meta) => {
            await projectsApi.addDocument(project.code, { ...meta, section: 'communication' });
            onChange();
          }}
        />
      </div>
    </div>
  );
}
