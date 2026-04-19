import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';
import { buildInputPeer, EntityType } from '@/lib/peer';

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  // Copy only the relevant slice — buf.buffer may be a larger shared backing store
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
    // thumb=1 → get thumbnail (for videos/animated stickers), thumb=0 → full download
    const wantThumb = url.searchParams.get('thumb') === '1';

    if (!rawId || !msgId) {
      return new NextResponse('rawId and msgId required', { status: 400 });
    }

    const client = createClient(session.sessionString);
    await client.connect();

    try {
      const peer = buildInputPeer(entityType, rawId, accessHash);
      const messages = await client.getMessages(peer, { ids: [msgId] });
      const msg = messages[0];

      if (!msg || !msg.media) {
        return new NextResponse('Media not found', { status: 404 });
      }

      // Determine actual MIME type from media
      let mimeType = 'image/jpeg';
      let isAnimatedSticker = false;

      if (msg.media instanceof Api.MessageMediaPhoto) {
        mimeType = 'image/jpeg';
      } else if (msg.media instanceof Api.MessageMediaDocument) {
        const doc = msg.media.document;
        if (doc instanceof Api.Document) {
          mimeType = doc.mimeType || 'application/octet-stream';
          if (mimeType === 'application/x-tgsticker') {
            isAnimatedSticker = true;
          }
        }
      }

      // For animated stickers (TGS = gzipped Lottie), browsers can't render the raw file.
      // Always fetch the thumbnail (a WebP/JPEG frame) instead.
      const needThumb = wantThumb || isAnimatedSticker;

      let downloadResult: Buffer | string;
      if (needThumb) {
        downloadResult = await client.downloadMedia(msg, { thumb: 0 }) as Buffer | string;
        // Thumbnails are always JPEG
        mimeType = 'image/jpeg';
      } else {
        downloadResult = await client.downloadMedia(msg, {}) as Buffer | string;
      }

      // downloadMedia can return string (filepath) in some configs — normalise to Buffer
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

      return new NextResponse(bufferToArrayBuffer(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=86400, immutable',
        },
      });
    } finally {
      await client.disconnect();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[media]', message);
    return new NextResponse(`Media error: ${message}`, { status: 500 });
  }
}
