'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, Send, Loader2, ImageIcon, Film, FileText, Upload } from 'lucide-react';

interface AttachedFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'file';
}

interface Props {
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  placeholder: string;
  onSendText: (e: React.FormEvent) => void;
  onSendMedia: (files: File[], caption: string) => Promise<void>;
}

function fileType(f: File): 'image' | 'video' | 'file' {
  if (f.type.startsWith('image/')) return 'image';
  if (f.type.startsWith('video/')) return 'video';
  return 'file';
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaInput({ input, setInput, sending, placeholder, onSendText, onSendMedia }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  function pickFiles() {
    fileInputRef.current?.click();
  }

  function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;

    const newFiles: AttachedFile[] = chosen.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      previewUrl: fileType(f) !== 'file' ? URL.createObjectURL(f) : '',
      type: fileType(f),
    }));

    setAttached((prev) => [...prev, ...newFiles]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function removeFile(id: string) {
    setAttached((prev) => {
      const f = prev.find((a) => a.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    if (attached.length > 0) {
      setUploadProgress(0);
      try {
        await onSendMedia(attached.map((a) => a.file), input.trim());
        attached.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
        setAttached([]);
        setInput('');
      } finally {
        setUploadProgress(null);
      }
    } else {
      onSendText(e);
    }
  }

  const canSend = !sending && uploadProgress === null && (input.trim().length > 0 || attached.length > 0);

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      {/* Attached files preview bar */}
      {attached.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 14px 0',
            overflowX: 'auto',
            flexWrap: 'wrap',
          }}
        >
          {attached.map((a) => (
            <div
              key={a.id}
              style={{
                position: 'relative',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {a.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.previewUrl}
                  alt={a.file.name}
                  style={{ width: '72px', height: '72px', objectFit: 'cover', display: 'block' }}
                />
              ) : a.type === 'video' ? (
                <div style={{ width: '72px', height: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(108,99,255,0.15)' }}>
                  <Film size={22} color="var(--accent)" />
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all' }}>
                    {formatBytes(a.file.size)}
                  </span>
                </div>
              ) : (
                <div style={{ width: '72px', height: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px' }}>
                  <FileText size={22} color="var(--accent)" />
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textAlign: 'center', wordBreak: 'break-all', lineHeight: '1.2' }}>
                    {a.file.name.length > 14 ? a.file.name.slice(0, 12) + '…' : a.file.name}
                  </span>
                </div>
              )}

              {/* File type badge */}
              <div style={{ position: 'absolute', bottom: '3px', left: '3px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '1px 4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                {a.type === 'image' ? <ImageIcon size={9} color="white" /> : a.type === 'video' ? <Film size={9} color="white" /> : <FileText size={9} color="white" />}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeFile(a.id)}
                style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Add more button */}
          <button
            type="button"
            onClick={pickFiles}
            style={{ width: '72px', height: '72px', borderRadius: '10px', border: '2px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', flexShrink: 0 }}
          >
            <Upload size={16} />
            Add
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div style={{ padding: '6px 14px 0' }}>
          <div style={{ height: '3px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', width: '100%', animation: 'pulse 1.2s infinite' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            Uploading…
          </div>
        </div>
      )}

      {/* Text input row */}
      <form
        onSubmit={handleSend}
        style={{ display: 'flex', gap: '8px', padding: '10px 14px 14px', alignItems: 'flex-end' }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.mp3,.m4a"
          style={{ display: 'none' }}
          onChange={onFilesChosen}
        />

        {/* Attachment button */}
        <button
          type="button"
          onClick={pickFiles}
          title="Attach files"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: attached.length > 0 ? 'var(--accent-light)' : 'var(--bg-hover)',
            border: 'none',
            color: attached.length > 0 ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <Paperclip size={17} />
        </button>

        {/* Text input */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={attached.length > 0 ? 'Add a caption…' : placeholder}
          style={{
            flex: 1,
            padding: '11px 14px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
          }}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!canSend}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
            border: 'none',
            color: canSend ? 'white' : 'var(--text-secondary)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {sending || uploadProgress !== null
            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
