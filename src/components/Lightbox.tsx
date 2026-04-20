'use client';

import { useEffect, useState } from 'react';
import { X, Download, Zap } from 'lucide-react';

interface LightboxProps {
  src: string;           // full quality URL
  previewSrc?: string;   // fast animated preview URL (videos only)
  type: 'photo' | 'video' | 'sticker' | 'gif';
  onClose: () => void;
}

export default function Lightbox({ src, previewSrc, type, onClose }: LightboxProps) {
  // Videos start on preview (fast); user can tap HD to switch to full quality
  const [useFullQuality, setUseFullQuality] = useState(!previewSrc || type !== 'video');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeSrc = (type === 'video' && !useFullQuality && previewSrc) ? previewSrc : src;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HD toggle — only shown for videos that have a preview */}
        {type === 'video' && previewSrc && (
          <button
            onClick={() => setUseFullQuality((v) => !v)}
            title={useFullQuality ? 'Switch to fast preview' : 'Switch to full quality'}
            style={{
              height: '40px',
              padding: '0 14px',
              borderRadius: '10px',
              background: useFullQuality ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'white',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              transition: 'background 0.2s',
            }}
          >
            <Zap size={14} fill={useFullQuality ? 'white' : 'none'} />
            {useFullQuality ? 'HD' : 'HD'}
          </button>
        )}

        <a
          href={src}
          download
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            textDecoration: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Download size={18} />
        </a>
        <button
          onClick={onClose}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Media */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {type === 'video' ? (
          <video
            key={activeSrc}   // remount when src changes so it reloads
            src={activeSrc}
            controls
            autoPlay
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', outline: 'none' }}
          />
        ) : type === 'gif' ? (
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', outline: 'none' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Media"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      <p
        style={{
          position: 'absolute',
          bottom: '16px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
          margin: 0,
        }}
      >
        {type === 'video' && previewSrc && !useFullQuality
          ? 'Preview mode — tap HD for full quality'
          : 'Press Esc or click outside to close'}
      </p>
    </div>
  );
}
