'use client';

import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface LightboxProps {
  src: string;
  type: 'photo' | 'video' | 'sticker';
  onClose: () => void;
}

export default function Lightbox({ src, type, onClose }: LightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      {/* Controls */}
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
            src={src}
            controls
            autoPlay
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              outline: 'none',
            }}
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
        Press Esc or click outside to close
      </p>
    </div>
  );
}
