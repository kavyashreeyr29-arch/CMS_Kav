import { MimeKind } from '../types/ticket';

export interface UploadedFileMeta {
  fileName: string;
  fileSize: number;
  mimeKind: MimeKind;
  storageKey: string;
}

function mimeKindOf(file: File): MimeKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'doc';
}

/**
 * Shared upload flow for both ticket attachments and project documents: ask
 * the backend to sign a PUT URL, push the file bytes straight to object
 * storage (MinIO/S3 — the backend never sees the file), then hand back the
 * metadata the caller records via addAttachment/addDocument.
 */
export async function uploadFile(
  file: File,
  requestUploadUrl: (fileName: string) => Promise<{ uploadUrl: string; storageKey: string }>,
): Promise<UploadedFileMeta> {
  const { uploadUrl, storageKey } = await requestUploadUrl(file.name);

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);

  return { fileName: file.name, fileSize: file.size, mimeKind: mimeKindOf(file), storageKey };
}
