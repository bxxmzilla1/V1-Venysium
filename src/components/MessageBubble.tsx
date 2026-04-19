'use client';

import { useState } from 'react';
import { Play, FileText, Mic, Music, ImageOff, Loader2 } from 'lucide-react';
import Lightbox from './Lightbox';

type MediaType = 'photo' | 'gif' | 'video' | 'voice' | 'audio' | 'sticker' | 'sticker_animated' | 'document' | null;

interface Props {
  id: number;
  message: string;
  date: number;
  out: boolean;
  mediaType: MediaType;
  rawId: string;
  entityType: string;
  accessHash: string;
  formatDate: (ts: number) => string;
}

// q=thumb  → smallest thumbnail (fast, for inline)
// q=medium → medium size (for stickers / moderate quality)
// q=full   → original file (for lightbox)
// thumb=1  → always use thumb index (for videos/animated stickers)
function mediaUrl(rawId: string, entityType: string, accessHash: string, msgId: number, opts: { q?: string; thumb?: boolean } = {}) {
  let u = `/api/media?rawId=${encodeURIComponent(rawId)}&entityType=${entityType}&accessHash=${encodeURIComponent(accessHash)}&msgId=${msgId}`;
  if (opts.q) u += `&q=${opts.q}`;
  if (opts.thumb) u += `&thumb=1`;
  return u;
}

// Reusable lazy image — shows spinner while loading, error state on failure
function LazyImage({
  src, maxW = 300, maxH = 400, onClick, rounded = false,
}: {
  src: string; maxW?: number; maxH?: number; onClick?: () => void; rounded?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.35)' }}>
        <ImageOff size={18} />
        <span style={{ fontSize: '12px' }}>Media unavailable</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        minHeight: loaded ? undefined : '100px',
        minWidth: loaded ? undefined : '140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: loaded ? 'transparent' : 'rgba(0,0,0,0.15)',
        borderRadius: rounded ? '12px' : undefined,
        overflow: 'hidden',
      }}
    >
      {!loaded && (
        <Loader2 size={20} style={{ color: 'rgba(255,255,255,0.35)', animation: 'spin 1s linear infinite', position: 'absolute' }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          maxWidth: maxW,
          maxHeight: maxH,
          width: '100%',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s',
          borderRadius: rounded ? '12px' : undefined,
        }}
      />
    </div>
  );
}

export default function MessageBubble({ id, message, date, out, mediaType, rawId, entityType, accessHash, formatDate }: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; type: 'photo' | 'video' | 'sticker' | 'gif' } | null>(null);

  // Inline thumbnail (fast) — used for everything shown in the chat list
  const thumbUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'thumb' });
  // Full resolution — only loaded when user opens lightbox
  const fullUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'full' });
  // Video thumb specifically (uses thumb index, not sizeType)
  const videoThumbUrl = mediaUrl(rawId, entityType, accessHash, id, { thumb: true });
  // GIF / video full download URL
  const gifVideoUrl = mediaUrl(rawId, entityType, accessHash, id, {});

  const isSticker = mediaType === 'sticker' || mediaType === 'sticker_animated';

  const bubbleStyle: React.CSSProperties = {
    maxWidth: '70%',
    borderRadius: '18px',
    overflow: 'hidden',
    marginLeft: out ? 'auto' : undefined,
    marginRight: out ? undefined : 'auto',
    background: isSticker ? 'transparent' : out ? 'var(--sent-bubble)' : 'var(--recv-bubble)',
    borderBottomRightRadius: out ? '4px' : '18px',
    borderBottomLeftRadius: out ? '18px' : '4px',
  };

  function renderMedia() {
    switch (mediaType) {

      // ── Photo — thumbnail inline, full in lightbox ─────────────────────────
      case 'photo':
        return (
          <>
            <LazyImage
              src={thumbUrl}
              maxW={300} maxH={360}
              onClick={() => setLightbox({ src: fullUrl, type: 'photo' })}
            />
            {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
          </>
        );

      // ── Static sticker (WebP) ──────────────────────────────────────────────
      case 'sticker':
        return (
          <>
            <LazyImage
              src={thumbUrl}
              maxW={160} maxH={160} rounded
              onClick={() => setLightbox({ src: fullUrl, type: 'sticker' })}
            />
            {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
          </>
        );

      // ── Animated sticker (TGS → serve thumbnail frame) ────────────────────
      case 'sticker_animated':
        return (
          <>
            <LazyImage
              src={thumbUrl}
              maxW={160} maxH={160} rounded
              onClick={() => setLightbox({ src: thumbUrl, type: 'sticker' })}
            />
            {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
          </>
        );

      // ── GIF (Telegram stores these as looping MP4) ────────────────────────
      case 'gif':
        return (
          <video
            src={gifVideoUrl}
            autoPlay loop muted playsInline
            style={{ maxWidth: '300px', maxHeight: '300px', width: '100%', display: 'block' }}
          />
        );

      // ── Video — thumbnail with play button, full video in lightbox ─────────
      case 'video':
        return (
          <>
            <div
              onClick={() => setLightbox({ src: gifVideoUrl, type: 'video' })}
              style={{ position: 'relative', cursor: 'pointer', display: 'inline-block', lineHeight: 0 }}
            >
              <LazyImage src={videoThumbUrl} maxW={300} maxH={300} />
              {/* Play overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={22} color="white" style={{ marginLeft: '3px' }} />
                </div>
              </div>
              <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px' }}>
                VIDEO
              </span>
            </div>
            {lightbox && <Lightbox src={lightbox.src} type="video" onClose={() => setLightbox(null)} />}
          </>
        );

      // ── Voice message ──────────────────────────────────────────────────────
      case 'voice':
        return (
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: out ? 'rgba(255,255,255,0.2)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mic size={16} color="white" />
            </div>
            <audio controls src={gifVideoUrl} style={{ height: '34px', maxWidth: '220px' }} />
          </div>
        );

      // ── Audio / music ──────────────────────────────────────────────────────
      case 'audio':
        return (
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: out ? 'rgba(255,255,255,0.2)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Music size={16} color="white" />
            </div>
            <audio controls src={gifVideoUrl} style={{ height: '34px', maxWidth: '220px' }} />
          </div>
        );

      // ── Document / file ────────────────────────────────────────────────────
      case 'document':
        return (
          <a href={gifVideoUrl} download style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: out ? 'rgba(255,255,255,0.2)' : 'rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={20} color={out ? 'white' : 'var(--accent)'} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>Document</div>
              <div style={{ fontSize: '11px', opacity: 0.6 }}>Tap to download</div>
            </div>
          </a>
        );

      default:
        return null;
    }
  }

  const media = renderMedia();

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
      <div style={bubbleStyle}>
        {media}
        {message && (
          <div style={{ padding: media ? '6px 14px 10px' : '10px 14px', fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word' }}>
            {message}
          </div>
        )}
      </div>
      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px', padding: '0 4px' }}>
        {formatDate(date)}
      </span>
    </div>
  );
}
