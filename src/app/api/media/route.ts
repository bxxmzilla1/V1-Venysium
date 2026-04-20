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

    // quality: 'thumb' = smallest (~s), 'medium' = medium (~m), 'full' = original
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

      // getMessages can return MessageEmpty for inaccessible messages
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

      // Decide what to actually download
      // Thumbnails: animated stickers, 'thumb' quality, video thumbnails
      const useThumbnail = isAnimatedSticker || quality === 'thumb' || (isVideo && quality !== 'full');

      let downloadParams: { thumb?: number; sizeType?: string } = {};

      if (useThumbnail) {
        // thumb:0 = first/smallest thumbnail from Telegram's available sizes
        downloadParams = { thumb: 0 };
        mimeType = 'image/jpeg';
      } else if (quality === 'medium' && !isGif && !isVideo) {
        // 'x' = ~800px — large enough to be sharp, smaller than original
        downloadParams = { sizeType: 'x' };
        mimeType = 'image/jpeg';
      }
      // 'full' or GIFs/videos: no extra params, download full file

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

      return new NextResponse(bufferToArrayBuffer(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=604800, immutable', // 7 days
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
