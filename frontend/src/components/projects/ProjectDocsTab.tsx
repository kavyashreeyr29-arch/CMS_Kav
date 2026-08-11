import { Folder, Briefcase, Download } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { exportToCsv } from '../ui/exportCsv';
import { Project } from '../../types/project';

interface Props {
  project: Project;
  onChange: () => void;
}

export function ProjectDocsTab({ project, onChange }: Props) {
  const generalDocs = project.documents.filter((d) => !d.section);
  const commercialDocs = project.documents.filter((d) => d.section === 'commercial');

  function exportManifest() {
    exportToCsv(
      `${project.code}-documents`,
      ['File name', 'Section', 'Type', 'Size (bytes)', 'Uploaded'],
      project.documents.map((d) => [d.fileName, d.section ?? 'general', d.mimeKind, d.fileSize, new Date(d.createdAt).toLocaleString()]),
    );
  }

  return (
    <div>
      <div className="td-section-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Folder size={13} />Document folder ({generalDocs.length})</span>
        <button className="btn-ghost" onClick={exportManifest} disabled={project.documents.length === 0}><Download size={12} />Export manifest CSV</button>
      </div>
      <AttachmentGrid
        files={generalDocs}
        getDownloadUrl={(documentId) => projectsApi.getDocumentDownloadUrl(project.code, documentId)}
      />
      <div style={{ marginTop: 8, marginBottom: 22 }}>
        <AttachmentUploader
          label="Add BRDs, data files, decks, or other project documents"
          requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
          onUploaded={async (meta) => { await projectsApi.addDocument(project.code, meta); onChange(); }}
        />
      </div>

      <div className="td-section-title"><Briefcase size={13} />Commercial documents ({commercialDocs.length})</div>
      <div className="panel-sub" style={{ marginTop: -6, marginBottom: 8 }}>
        Agreements, SOWs, quotes, invoices — kept separate from general project files.
      </div>
      <AttachmentGrid
        files={commercialDocs}
        getDownloadUrl={(documentId) => projectsApi.getDocumentDownloadUrl(project.code, documentId)}
      />
      <div style={{ marginTop: 8 }}>
        <AttachmentUploader
          label="Add the signed agreement, SOW, quote, or invoice"
          requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
          onUploaded={async (meta) => { await projectsApi.addDocument(project.code, { ...meta, section: 'commercial' }); onChange(); }}
        />
      </div>
    </div>
  );
}
