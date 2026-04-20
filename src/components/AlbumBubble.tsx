'use client';

import { useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface Message {
  id: number;
  message: string;
  date: number;
  out: boolean;
  mediaType: string | null;
  groupedId: string | null;
}

interface Album {
  kind: 'album';
  groupedId: string;
  messages: Message[];
  out: boolean;
  date: number;
}

interface Props {
  album: Album;
  rawId: string;
  entityType: string;
  accessHash: string;
  formatDate: (ts: number) => string;
}

const MAX_VISIBLE = 4;

function thumbUrl(rawId: string, entityType: string, accessHash: string, msgId: number) {
  return `/api/media?rawId=${encodeURIComponent(rawId)}&entityType=${entityType}&accessHash=${encodeURIComponent(accessHash)}&msgId=${msgId}&q=thumb`;
}
function mediumUrl(rawId: string, entityType: string, accessHash: string, msgId: number) {
  return `/api/media?rawId=${encodeURIComponent(rawId)}&entityType=${entityType}&accessHash=${encodeURIComponent(accessHash)}&msgId=${msgId}&q=medium`;
}
function fullUrl(rawId: string, entityType: string, accessHash: string, msgId: number) {
  return `/api/media?rawId=${encodeURIComponent(rawId)}&entityType=${entityType}&accessHash=${encodeURIComponent(accessHash)}&msgId=${msgId}&q=full`;
}

// Full-screen album lightbox with prev/next navigation
function AlbumLightbox({ messages, startIndex, rawId, entityType, accessHash, onClose }: {
  messages: Message[];
  startIndex: number;
  rawId: string;
  entityType: string;
  accessHash: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  function prev() { setIdx((i) => Math.max(0, i - 1)); }
  function next() { setIdx((i) => Math.min(messages.length - 1, i + 1)); }

  const msg = messages[idx];
  const isVideo = msg.mediaType === 'video';
  const isGif = msg.mediaType === 'gif';
  const src = fullUrl(rawId, entityType, accessHash, msg.id);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease' }}
    >
      {/* Top bar */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600' }}>
          {idx + 1} / {messages.length}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href={src} download onClick={(e) => e.stopPropagation()} style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', backdropFilter: 'blur(8px)' }}>
            <Download size={16} />
          </a>
          <button onClick={onClose} style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Media */}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isVideo ? (
          <video src={src} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '10px' }} />
        ) : isGif ? (
          <video src={fullUrl(rawId, entityType, accessHash, msg.id)} autoPlay loop muted playsInline style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '10px' }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '10px', objectFit: 'contain' }} />
        )}
      </div>

      {/* Prev / Next */}
      {messages.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            disabled={idx === 0}
            style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', background: idx === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            disabled={idx === messages.length - 1}
            style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', background: idx === messages.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: idx === messages.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {messages.length > 1 && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: '20px', display: 'flex', gap: '6px', maxWidth: '80vw', overflowX: 'auto', padding: '0 8px' }}>
          {messages.map((m, i) => (
            <div
              key={m.id}
              onClick={() => setIdx(i)}
              style={{ width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: i === idx ? '2px solid var(--accent)' : '2px solid transparent', flexShrink: 0, transition: 'border-color 0.15s' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(rawId, entityType, accessHash, m.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlbumBubble({ album, rawId, entityType, accessHash, formatDate }: Props) {
  const [lightboxStart, setLightboxStart] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { messages, out, date } = album;
  const total = messages.length;
  const visibleCount = showAll ? total : Math.min(MAX_VISIBLE, total);
  const visible = messages.slice(0, visibleCount);
  const remaining = total - MAX_VISIBLE;

  // Compute grid layout
  function getGridStyle(count: number): React.CSSProperties {
    if (count === 1) return { gridTemplateColumns: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr' };
    return { gridTemplateColumns: '1fr 1fr 1fr' };
  }

  const caption = messages.find((m) => m.message)?.message || '';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start', maxWidth: '75%', marginLeft: out ? 'auto' : undefined }}>
      {/* Photo grid */}
      <div
        style={{
          display: 'grid',
          gap: '3px',
          borderRadius: '14px',
          overflow: 'hidden',
          ...getGridStyle(Math.min(visibleCount, 3)),
          maxWidth: '340px',
          width: '100%',
        }}
      >
        {visible.map((msg, i) => {
          const isLast = !showAll && i === MAX_VISIBLE - 1 && remaining > 0;
          return (
            <div
              key={msg.id}
              onClick={() => setLightboxStart(i)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                overflow: 'hidden',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)',
                // Make 4th item (bottom-left) span correctly
                gridColumn: visibleCount >= 4 && i === 3 ? '1' : undefined,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediumUrl(rawId, entityType, accessHash, msg.id)}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
              />
              {/* "+N" overlay on last visible */}
              {isLast && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontSize: '26px', fontWeight: '700' }}>+{remaining}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* "Show all N photos" button */}
      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          style={{ marginTop: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '4px 2px', textDecoration: 'underline' }}
        >
          Show all {total} photos
        </button>
      )}

      {/* Caption */}
      {caption && (
        <div style={{ marginTop: '4px', padding: '6px 12px 8px', background: out ? 'var(--sent-bubble)' : 'var(--recv-bubble)', borderRadius: '12px', fontSize: '14px', lineHeight: '1.5', maxWidth: '340px', wordBreak: 'break-word' }}>
          {caption}
        </div>
      )}

      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', padding: '0 2px' }}>
        {formatDate(date)}
      </span>

      {/* Lightbox */}
      {lightboxStart !== null && (
        <AlbumLightbox
          messages={messages}
          startIndex={lightboxStart}
          rawId={rawId}
          entityType={entityType}
          accessHash={accessHash}
          onClose={() => setLightboxStart(null)}
        />
      )}
    </div>
  );
}
