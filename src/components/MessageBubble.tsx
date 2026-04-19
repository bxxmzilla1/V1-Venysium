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

function mediaUrl(rawId: string, entityType: string, accessHash: string, msgId: number, thumb = false) {
  return `/api/media?rawId=${encodeURIComponent(rawId)}&entityType=${entityType}&accessHash=${encodeURIComponent(accessHash)}&msgId=${msgId}${thumb ? '&thumb=1' : ''}`;
}

// Reusable inline image with loader + error state
function MediaImage({
  src, maxW = 300, maxH = 400, onClick,
}: {
  src: string; maxW?: number; maxH?: number; onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', minWidth: '120px' }}>
        <ImageOff size={22} />
        <span style={{ fontSize: '11px' }}>Failed to load</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', cursor: onClick ? 'pointer' : 'default', minHeight: loaded ? undefined : '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }} onClick={onClick}>
      {!loaded && <Loader2 size={22} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite', position: 'absolute' }} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{ maxWidth: maxW, maxHeight: maxH, width: '100%', display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
      />
    </div>
  );
}

export default function MessageBubble({ id, message, date, out, mediaType, rawId, entityType, accessHash, formatDate }: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; type: 'photo' | 'video' | 'sticker' } | null>(null);

  const src = mediaUrl(rawId, entityType, accessHash, id, false);
  const thumbSrc = mediaUrl(rawId, entityType, accessHash, id, true);

  const isSticker = mediaType === 'sticker' || mediaType === 'sticker_animated';

  // ── bubble styles ──────────────────────────────────────────────────────────
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

  // ── render media ────────────────────────────────────────────────────────────
  function renderMedia() {
    switch (mediaType) {

      // ── Photos ─────────────────────────────────────────────────────────────
      case 'photo':
        return (
          <>
            <MediaImage src={src} onClick={() => setLightbox({ src, type: 'photo' })} />
            {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
          </>
        );

      // ── Static stickers (WebP) ─────────────────────────────────────────────
      case 'sticker':
        return (
          <>
            <MediaImage src={src} maxW={160} maxH={160} onClick={() => setLightbox({ src, type: 'sticker' })} />
            {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
          </>
        );

      // ── Animated stickers (TGS → serve thumbnail) ──────────────────────────
      case 'sticker_animated':
        return (
          <>
            <MediaImage src={thumbSrc} maxW={160} maxH={160} onClick={() => setLightbox({ src: thumbSrc, type: 'sticker' })} />
            {lightbox && <Lightbox src={lightbox.src} type={lightbox.type} onClose={() => setLightbox(null)} />}
          </>
        );

      // ── GIFs (stored as looping MP4 by Telegram) ───────────────────────────
      case 'gif':
        return (
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            style={{ maxWidth: '300px', maxHeight: '300px', width: '100%', display: 'block', borderRadius: '4px' }}
          />
        );

      // ── Videos ─────────────────────────────────────────────────────────────
      case 'video':
        return (
          <>
            <div
              onClick={() => setLightbox({ src, type: 'video' })}
              style={{ position: 'relative', cursor: 'pointer', minWidth: '180px', minHeight: '140px', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <MediaImage src={thumbSrc} maxW={300} maxH={300} />
              {/* Play button overlay */}
              <div style={{ position: 'absolute', width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={22} color="white" style={{ marginLeft: '3px' }} />
              </div>
              <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                VIDEO
              </span>
            </div>
            {lightbox && <Lightbox src={lightbox.src} type="video" onClose={() => setLightbox(null)} />}
          </>
        );

      // ── Voice messages ─────────────────────────────────────────────────────
      case 'voice':
        return (
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: out ? 'rgba(255,255,255,0.2)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mic size={16} color="white" />
            </div>
            <audio controls src={src} style={{ height: '34px', maxWidth: '220px' }} />
          </div>
        );

      // ── Audio / music ───────────────────────────────────────────────────────
      case 'audio':
        return (
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: out ? 'rgba(255,255,255,0.2)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Music size={16} color="white" />
            </div>
            <audio controls src={src} style={{ height: '34px', maxWidth: '220px' }} />
          </div>
        );

      // ── Documents / files ───────────────────────────────────────────────────
      case 'document':
        return (
          <a href={src} download style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
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
        {/* Text caption shown below media if both exist, or just text for text-only messages */}
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
