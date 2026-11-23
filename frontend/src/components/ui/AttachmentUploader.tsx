import { DragEvent, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadFile, UploadedFileMeta } from '../../api/uploadFile';

interface Props {
  requestUploadUrl: (fileName: string) => Promise<{ uploadUrl: string; storageKey: string }>;
  onUploaded: (meta: UploadedFileMeta) => Promise<void> | void;
  label?: string;
}

export function AttachmentUploader({ requestUploadUrl, onUploaded, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const meta = await uploadFile(file, requestUploadUrl);
        await onUploaded(meta);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  const labelText = label ?? 'Drop files here or click to upload — documents, images, or videos';

  return (
    <div>
      <div
        className={`dropzone ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label={uploading ? 'Uploading…' : labelText}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <Upload size={16} />
        <span>{uploading ? 'Uploading…' : labelText}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
