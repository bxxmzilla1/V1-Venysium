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
  src, fixedW, maxW = 300, maxH = 400, onClick, rounded = false, cover = false,
}: {
  src: string;
  /** Force the container to this exact pixel width (prevents collapsing to thumbnail size) */
  fixedW?: number;
  maxW?: number;
  maxH?: number;
  onClick?: () => void;
  rounded?: boolean;
  /** Use object-fit:cover to fill the container */
  cover?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const containerW = fixedW ?? undefined;

  if (error) {
    return (
      <div style={{ width: containerW, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.15)', borderRadius: rounded ? '12px' : undefined }}>
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
        width: containerW,
        minWidth: containerW ?? (loaded ? undefined : '200px'),
        minHeight: loaded ? undefined : '160px',
        maxWidth: maxW,
        maxHeight: loaded ? maxH : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: loaded ? 'transparent' : 'rgba(0,0,0,0.12)',
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
          width: cover ? '100%' : (containerW ? '100%' : 'auto'),
          height: cover ? '100%' : 'auto',
          maxWidth: cover ? undefined : maxW,
          maxHeight: cover ? undefined : maxH,
          display: 'block',
          objectFit: cover ? 'cover' : 'contain',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s',
          borderRadius: rounded ? '12px' : undefined,
        }}
      />
    </div>
  );
}

// Inline video: shows Telegram's animated preview clip, falls back to static thumbnail.
// Clicking always opens the full video in a lightbox.
function VideoInline({ previewUrl, fallbackThumbUrl, fullUrl }: {
  previewUrl: string;
  fallbackThumbUrl: string;
  fullUrl: string;
}) {
  const [lightbox, setLightboxV] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  return (
    <>
      <div
        onClick={() => setLightboxV(true)}
        style={{ position: 'relative', cursor: 'pointer', width: '260px', lineHeight: 0, borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}
      >
        {useFallback ? (
          <LazyImage src={fallbackThumbUrl} fixedW={260} maxH={300} />
        ) : (
          <video
            src={previewUrl}
            muted
            playsInline
            poster={fallbackThumbUrl}
            onError={() => setUseFallback(true)}
            style={{ width: '260px', maxHeight: '300px', display: 'block', objectFit: 'cover' }}
          />
        )}
        {/* Play button overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={22} color="white" style={{ marginLeft: '3px' }} />
          </div>
        </div>
        <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
          VIDEO
        </span>
      </div>
      {lightbox && (
        <Lightbox
          src={fullUrl}
          previewSrc={previewUrl}
          type="video"
          onClose={() => setLightboxV(false)}
        />
      )}
    </>
  );
}

export default function MessageBubble({ id, message, date, out, mediaType, rawId, entityType, accessHash, formatDate }: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; type: 'photo' | 'video' | 'sticker' | 'gif' } | null>(null);

  // Tiny thumbnail — used only for stickers and video poster frames
  const thumbUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'thumb' });
  // Medium quality — used for inline photo/gif display (sharp enough, faster than full)
  const mediumUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'medium' });
  // Full resolution — only loaded when user opens lightbox
  const fullUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'full' });
  // Video poster frame (static image fallback)
  const videoThumbUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'thumb' });
  // 480p transcoded stream (fast loading, reasonable quality)
  const videoPreviewUrl = mediaUrl(rawId, entityType, accessHash, id, { q: '480p' });
  // Full video / GIF file URL
  const gifVideoUrl = mediaUrl(rawId, entityType, accessHash, id, { q: 'full' });

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

      // ── Photo — medium quality inline, full in lightbox ──────────────────────
      case 'photo':
        return (
          <>
            <LazyImage
              src={mediumUrl}
              fixedW={260} maxH={340}
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
              fixedW={160} maxH={160} rounded
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
              fixedW={160} maxH={160} rounded
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
            style={{ width: '260px', maxHeight: '300px', display: 'block', objectFit: 'contain', background: 'rgba(0,0,0,0.1)' }}
          />
        );

      // ── Video — animated preview (GIF-style) with play button overlay ────────
      case 'video':
        return (
          <VideoInline
            previewUrl={videoPreviewUrl}
            fallbackThumbUrl={videoThumbUrl}
            fullUrl={gifVideoUrl}
          />
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
