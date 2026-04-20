import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';
import { buildInputPeer, EntityType } from '@/lib/peer';

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return ab;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isAuthenticated || !session.sessionString) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = new URL(req.url);
    const rawId = url.searchParams.get('rawId');
    const entityType = (url.searchParams.get('entityType') || 'user') as EntityType;
    const accessHash = url.searchParams.get('accessHash') || '0';
    const msgId = parseInt(url.searchParams.get('msgId') || '0');
    // quality: 'thumb' = smallest, 'medium' = ~800px, 'full' = original
    const quality = url.searchParams.get('q') || 'thumb';

    if (!rawId || !msgId) {
      return new NextResponse('rawId and msgId required', { status: 400 });
    }

    const client = createClient(session.sessionString);
    await client.connect();

    try {
      const peer = buildInputPeer(entityType, rawId, accessHash);
      const result = await client.getMessages(peer, { ids: [msgId] });
      const msg = result[0];

      if (!msg || msg instanceof Api.MessageEmpty || !('media' in msg) || !msg.media) {
        return new NextResponse('Media not found', { status: 404 });
      }

      let mimeType = 'image/jpeg';
      let isAnimatedSticker = false;
      let isVideo = false;
      let isGif = false;

      if (msg.media instanceof Api.MessageMediaPhoto) {
        mimeType = 'image/jpeg';
      } else if (msg.media instanceof Api.MessageMediaDocument) {
        const doc = msg.media.document;
        if (doc instanceof Api.Document) {
          mimeType = doc.mimeType || 'application/octet-stream';
          if (mimeType === 'application/x-tgsticker') isAnimatedSticker = true;

          let hasVideo = false;
          let hasAnimated = false;
          for (const attr of doc.attributes) {
            if (attr instanceof Api.DocumentAttributeVideo) hasVideo = true;
            if (attr instanceof Api.DocumentAttributeAnimated) hasAnimated = true;
          }
          if (hasVideo && !hasAnimated) isVideo = true;
          if (hasAnimated) isGif = true;
        }
      }

      // ── Animated video preview (q=preview) ─────────────────────────────────
      // Telegram generates a short looping MP4 clip for every video message.
      // It lives in doc.videoThumbs as a VideoSize with type='v'.
      if (quality === 'preview' && msg.media instanceof Api.MessageMediaDocument) {
        const doc = msg.media.document;
        if (doc instanceof Api.Document && doc.videoThumbs && doc.videoThumbs.length > 0) {
          const animThumb = doc.videoThumbs.find(
            (t): t is Api.VideoSize => t instanceof Api.VideoSize && t.type === 'v'
          );
          if (animThumb) {
            const previewResult = await client.downloadMedia(msg, {
              thumb: animThumb as unknown as number,
            }) as Buffer | string;

            let previewBuf: Buffer;
            if (typeof previewResult === 'string') {
              const fs = await import('fs/promises');
              previewBuf = await fs.readFile(previewResult);
            } else {
              previewBuf = previewResult as Buffer;
            }

            if (previewBuf && previewBuf.length > 0) {
              return new NextResponse(bufferToArrayBuffer(previewBuf), {
                status: 200,
                headers: {
                  'Content-Type': 'video/mp4',
                  'Content-Length': previewBuf.length.toString(),
                  'Accept-Ranges': 'bytes',
                  'Cache-Control': 'public, max-age=604800, immutable',
                },
              });
            }
          }
        }
        // No animated preview available — fall through to static thumbnail
      }

      // Decide what to download
      // - animated stickers always get a thumbnail frame
      // - 'thumb' / 'preview' quality gets a small thumbnail image
      // - videos only get the full file when q=full; otherwise thumbnail poster
      const useThumbnail = isAnimatedSticker || quality === 'thumb' || quality === 'preview' || (isVideo && quality !== 'full');

      let downloadParams: { thumb?: number; sizeType?: string } = {};

      if (useThumbnail) {
        downloadParams = { thumb: 0 };
        mimeType = 'image/jpeg';
      } else if (quality === 'medium' && !isGif && !isVideo) {
        // 'x' ≈ 800px — sharp enough for album grid / inline display
        downloadParams = { sizeType: 'x' };
        mimeType = 'image/jpeg';
      }
      // quality === 'full', or GIFs, or videos → no extra params → download full file

      const downloadResult = await client.downloadMedia(msg, downloadParams) as Buffer | string;

      let buffer: Buffer;
      if (typeof downloadResult === 'string') {
        const fs = await import('fs/promises');
        buffer = await fs.readFile(downloadResult);
      } else {
        buffer = downloadResult as Buffer;
      }

      if (!buffer || buffer.length === 0) {
        return new NextResponse('Empty media', { status: 404 });
      }

      const totalSize = buffer.length;

      // ── Range request support (needed for video seek/buffering) ──────────────
      const rangeHeader = req.headers.get('range');
      if (rangeHeader && (isVideo || isGif)) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1]);
          const end = match[2] ? parseInt(match[2]) : totalSize - 1;
          const chunkSize = end - start + 1;
          const chunk = buffer.subarray(start, end + 1);

          return new NextResponse(bufferToArrayBuffer(chunk), {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': chunkSize.toString(),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=604800, immutable',
            },
          });
        }
      }

      return new NextResponse(bufferToArrayBuffer(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': totalSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      });
    } finally {
      await client.disconnect();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/media]', message);
    return new NextResponse(`Media error: ${message}`, { status: 500 });
  }
}
