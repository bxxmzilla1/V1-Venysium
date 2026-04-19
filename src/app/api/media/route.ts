import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';
import { buildInputPeer, EntityType } from '@/lib/peer';

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
    const thumb = url.searchParams.get('thumb') === '1';

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

      // Determine MIME type
      let mimeType = 'image/jpeg';
      if (msg.media instanceof Api.MessageMediaDocument) {
        const doc = msg.media.document;
        if (doc instanceof Api.Document) {
          mimeType = doc.mimeType || 'application/octet-stream';
        }
      }

      // Download — use thumb index 0 (smallest) for video previews
      const downloadParams: { thumb?: number } = {};
      if (thumb) downloadParams.thumb = 0;

      const buffer = await client.downloadMedia(msg, downloadParams) as Buffer;

      if (!buffer || buffer.length === 0) {
        return new NextResponse('Empty media', { status: 404 });
      }

      return new NextResponse(buffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          // Cache aggressively — Telegram media doesn't change
          'Cache-Control': 'public, max-age=86400, immutable',
        },
      });
    } finally {
      await client.disconnect();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(message, { status: 500 });
  }
}
