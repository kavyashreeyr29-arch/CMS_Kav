import { useEffect, useRef, useState } from 'react';
import { Mic, Video, Square, Trash2, Paperclip } from 'lucide-react';
import { uploadFile, UploadedFileMeta } from '../../api/uploadFile';

interface Props {
  kind: 'audio' | 'video';
  requestUploadUrl: (fileName: string) => Promise<{ uploadUrl: string; storageKey: string }>;
  onUploaded: (meta: UploadedFileMeta) => Promise<void> | void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * In-browser mic/camera recording for ticket attachments — records to a
 * webm Blob via MediaRecorder, then reuses the same signed-upload flow as
 * AttachmentUploader once the user reviews and attaches the clip. Distinct
 * from AttachmentUploader (which only handles files already on disk).
 */
export function MediaRecorderCapture({ kind, requestUploadUrl, onUploaded }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { audio: true, video: true } : { audio: true },
      );
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: kind === 'video' ? 'video/webm' : 'audio/webm' });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
    } catch {
      setError(`Could not access your ${kind === 'video' ? 'camera/microphone' : 'microphone'}. Check browser permissions.`);
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setElapsedMs(0);
  }

  async function attach() {
    if (!blobRef.current) return;
    setUploading(true);
    setError('');
    try {
      const ext = kind === 'video' ? 'webm' : 'webm';
      const fileName = `${kind === 'video' ? 'video-note' : 'voice-note'}-${Date.now()}.${ext}`;
      const file = new File([blobRef.current], fileName, { type: blobRef.current.type });
      const meta = await uploadFile(file, requestUploadUrl);
      await onUploaded(meta);
      discard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const Icon = kind === 'video' ? Video : Mic;
  const label = kind === 'video' ? 'video' : 'voice note';

  if (previewUrl) {
    return (
      <div className="recorder-preview">
        {kind === 'video' ? (
          <video src={previewUrl} controls style={{ width: '100%', maxHeight: 180, borderRadius: 8, background: '#000' }} />
        ) : (
          <audio src={previewUrl} controls style={{ width: '100%' }} />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-primary" onClick={attach} disabled={uploading}>
            <Paperclip size={13} />{uploading ? 'Attaching…' : `Attach ${label}`}
          </button>
          <button type="button" className="btn-ghost" onClick={discard} disabled={uploading}>
            <Trash2 size={13} />Discard
          </button>
        </div>
        {error && <div className="field-error" style={{ marginTop: 6 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={`select-pill ${recording ? 'recording' : ''}`}
        onClick={recording ? stop : start}
        aria-pressed={recording}
      >
        {recording ? <Square size={13} /> : <Icon size={13} />}
        {recording ? `Stop (${formatElapsed(elapsedMs)})` : `Record ${label}`}
      </button>
      {error && <div className="field-error" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
