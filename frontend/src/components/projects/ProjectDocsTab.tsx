import { Folder } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { AttachmentUploader } from '../ui/AttachmentUploader';
import { AttachmentGrid } from '../ui/AttachmentGrid';
import { Project } from '../../types/project';

interface Props {
  project: Project;
  onChange: () => void;
}

export function ProjectDocsTab({ project, onChange }: Props) {
  const generalDocs = project.documents.filter((d) => !d.section);

  return (
    <div>
      <div className="td-section-title"><Folder size={13} />Document folder ({generalDocs.length})</div>
      <AttachmentGrid
        files={generalDocs}
        getDownloadUrl={(documentId) => projectsApi.getDocumentDownloadUrl(project.code, documentId)}
      />
      <div style={{ marginTop: 8 }}>
        <AttachmentUploader
          label="Add BRDs, data files, decks, or other project documents"
          requestUploadUrl={(fileName) => projectsApi.requestDocumentUploadUrl(project.code, fileName)}
          onUploaded={async (meta) => { await projectsApi.addDocument(project.code, meta); onChange(); }}
        />
      </div>
    </div>
  );
}
