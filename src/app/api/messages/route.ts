import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';
import { buildInputPeer, EntityType } from '@/lib/peer';

type MediaType = 'photo' | 'video' | 'voice' | 'audio' | 'sticker' | 'document' | null;

function classifyMedia(media: Api.TypeMessageMedia | undefined | null): MediaType {
  if (!media) return null;
  if (media instanceof Api.MessageMediaPhoto) return 'photo';
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (!(doc instanceof Api.Document)) return 'document';
    for (const attr of doc.attributes) {
      if (attr instanceof Api.DocumentAttributeSticker) return 'sticker';
      if (attr instanceof Api.DocumentAttributeVideo) return 'video';
      if (attr instanceof Api.DocumentAttributeAudio) {
        return attr.voice ? 'voice' : 'audio';
      }
    }
    return 'document';
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.sessionString) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(req.url);
    const rawId = url.searchParams.get('rawId');
    const entityType = (url.searchParams.get('entityType') || 'user') as EntityType;
    const accessHash = url.searchParams.get('accessHash') || '0';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const minId = parseInt(url.searchParams.get('minId') || '0');

    if (!rawId) {
      return NextResponse.json({ error: 'rawId required' }, { status: 400 });
    }

    const messages = await withClient(session.sessionString, async (client) => {
      const peer = buildInputPeer(entityType, rawId, accessHash);
      const opts: { limit: number; minId?: number } = { limit };
      if (minId > 0) opts.minId = minId;

      const result = await client.getMessages(peer, opts);

      return result
        .reverse()
        .map((msg) => ({
          id: msg.id,
          message: msg.message || '',
          date: msg.date,
          out: msg.out,
          fromId: msg.fromId ? msg.fromId.toString() : null,
          mediaType: classifyMedia(msg.media),
        }));
    });

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
