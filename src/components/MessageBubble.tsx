'use client';

import { useState } from 'react';
import { Play, FileText, Mic, Music, ImageOff, Loader2 } from 'lucide-react';
import Lightbox from './Lightbox';

type MediaType = 'photo' | 'video' | 'voice' | 'audio' | 'sticker' | 'document' | null;

interface Props {
  id: number;
  message: string;
  date: number;
  out: boolean;
  mediaType: MediaType;
  // peer info for media URL
  rawId: string;
  entityType: string;
  accessHash: string;
  formatDate: (ts: number) => string;
}

function mediaUrl(rawId: string, entityType: string, accessHash: string, msgId: number, thumb = false) {
  return `/api/media?rawId=${encodeURIComponent(rawId)}&entityType=${entityType}&accessHash=${encodeURIComponent(accessHash)}&msgId=${msgId}${thumb ? '&thumb=1' : ''}`;
}

export default function MessageBubble({
  id, message, date, out, mediaType,
  rawId, entityType, accessHash, formatDate,
}: Props) {
  const [lightbox, setLightbox] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const isOut = out;
  const bubbleStyle: React.CSSProperties = {
    maxWidth: '70%',
    borderRadius: '18px',
    overflow: 'hidden',
    marginLeft: isOut ? 'auto' : undefined,
    marginRight: isOut ? undefined : 'auto',
    background: isOut ? 'var(--sent-bubble)' : 'var(--recv-bubble)',
    borderBottomRightRadius: isOut ? '4px' : '18px',
    borderBottomLeftRadius: isOut ? '18px' : '4px',
  };

  const src = mediaUrl(rawId, entityType, accessHash, id);
  const thumbSrc = mediaUrl(rawId, entityType, accessHash, id, true);

  function renderMedia() {
    if (!mediaType) return null;

    if (mediaType === 'photo' || mediaType === 'sticker') {
      return (
        <>
          <div
            onClick={() => !imgError && setLightbox(true)}
            style={{
              position: 'relative',
              cursor: imgError ? 'default' : 'pointer',
              minWidth: '200px',
              minHeight: imgLoaded ? undefined : '160px',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!imgLoaded && !imgError && (
              <Loader2
                size={24}
                style={{ color: 'rgba(255,255,255,0.5)', animation: 'spin 1s linear infinite', position: 'absolute' }}
              />
            )}
            {imgError ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)' }}>
                <ImageOff size={24} />
                <span style={{ fontSize: '12px' }}>Failed to load</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onLoad={() => setImgLoaded(true)}
                onError={() => { setImgError(true); setImgLoaded(true); }}
                style={{
                  maxWidth: '300px',
                  maxHeight: '400px',
                  width: '100%',
                  display: 'block',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.2s',
                }}
              />
            )}
          </div>
          {lightbox && (
            <Lightbox src={src} type="photo" onClose={() => setLightbox(false)} />
          )}
        </>
      );
    }

    if (mediaType === 'video') {
      return (
        <>
          <div
            onClick={() => setLightbox(true)}
            style={{
              position: 'relative',
              cursor: 'pointer',
              minWidth: '200px',
              minHeight: '160px',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Thumbnail */}
            {!imgError && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbSrc}
                alt=""
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                style={{
                  maxWidth: '300px',
                  maxHeight: '300px',
                  width: '100%',
                  display: 'block',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.2s',
                }}
              />
            )}
            {/* Play overlay */}
            <div
              style={{
                position: 'absolute',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={22} color="white" style={{ marginLeft: '3px' }} />
            </div>
            {/* Video label */}
            <span
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              VIDEO
            </span>
          </div>
          {lightbox && (
            <Lightbox src={src} type="video" onClose={() => setLightbox(false)} />
          )}
        </>
      );
    }

    if (mediaType === 'voice') {
      return (
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: isOut ? 'rgba(255,255,255,0.2)' : 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mic size={16} color="white" />
          </div>
          <audio controls src={src} style={{ height: '32px', maxWidth: '200px' }} />
        </div>
      );
    }

    if (mediaType === 'audio') {
      return (
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: isOut ? 'rgba(255,255,255,0.2)' : 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Music size={16} color="white" />
          </div>
          <audio controls src={src} style={{ height: '32px', maxWidth: '200px' }} />
        </div>
      );
    }

    if (mediaType === 'document') {
      return (
        <a
          href={src}
          download
          style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: isOut ? 'rgba(255,255,255,0.2)' : 'rgba(108,99,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileText size={20} color={isOut ? 'white' : 'var(--accent)'} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>Document</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Tap to download</div>
          </div>
        </a>
      );
    }

    return null;
  }

  const media = renderMedia();

  // Sticker: transparent background
  if (mediaType === 'sticker') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOut ? 'flex-end' : 'flex-start',
        }}
        className="animate-fade-in"
      >
        <div style={{ maxWidth: '180px', borderRadius: '12px', overflow: 'hidden' }}>
          {media}
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px', padding: '0 4px' }}>
          {formatDate(date)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOut ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={bubbleStyle}>
        {/* Media above text (if both exist) */}
        {media}
        {/* Text caption */}
        {message && (
          <div style={{ padding: '10px 14px', fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word' }}>
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
