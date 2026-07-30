import { useState } from 'react';
import { Download, FileText, Image as ImageIcon, Mic, Video } from 'lucide-react';

interface AttachmentLike {
  id: string;
  fileName: string;
  fileSize: number;
  mimeKind: 'image' | 'video' | 'doc' | 'audio';
}

interface Props {
  files: AttachmentLike[];
  getDownloadUrl: (id: string) => Promise<{ downloadUrl: string }>;
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mimeKind: AttachmentLike['mimeKind']) {
  if (mimeKind === 'image') return <ImageIcon size={18} />;
  if (mimeKind === 'video') return <Video size={18} />;
  if (mimeKind === 'audio') return <Mic size={18} />;
  return <FileText size={18} />;
}

export function AttachmentGrid({ files, getDownloadUrl }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function download(id: string) {
    setDownloadingId(id);
    try {
      const { downloadUrl } = await getDownloadUrl(id);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }

  if (!files.length) return <div className="att-empty">No files yet.</div>;

  return (
    <div className="att-grid">
      {files.map((a) => (
        <div className="att-card" key={a.id}>
          <div className="att-thumb-doc">{iconFor(a.mimeKind)}</div>
          <div className="att-meta">
            <div className="att-name" title={a.fileName}>{a.fileName}</div>
            <div className="att-size">{fileSizeLabel(a.fileSize)}</div>
          </div>
          <button
            className="att-download-btn"
            onClick={(e) => { e.stopPropagation(); download(a.id); }}
            disabled={downloadingId === a.id}
            aria-label={`Download ${a.fileName}`}
          >
            <Download size={11} />{downloadingId === a.id ? 'Downloading…' : 'Download'}
          </button>
        </div>
      ))}
    </div>
  );
}
