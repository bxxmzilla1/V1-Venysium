import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';
import { buildInputPeer, EntityType } from '@/lib/peer';

type MediaType = 'photo' | 'gif' | 'video' | 'voice' | 'audio' | 'sticker' | 'sticker_animated' | 'document' | null;

function classifyMedia(media: Api.TypeMessageMedia | undefined | null): MediaType {
  if (!media) return null;
  if (media instanceof Api.MessageMediaPhoto) return 'photo';
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (!(doc instanceof Api.Document)) return 'document';

    let isAnimated = false;
    let isSticker = false;
    let isVideo = false;
    let isVoice = false;
    let isAudio = false;

    for (const attr of doc.attributes) {
      if (attr instanceof Api.DocumentAttributeAnimated) isAnimated = true;
      if (attr instanceof Api.DocumentAttributeSticker) isSticker = true;
      if (attr instanceof Api.DocumentAttributeVideo) isVideo = true;
      if (attr instanceof Api.DocumentAttributeAudio) {
        if (attr.voice) isVoice = true;
        else isAudio = true;
      }
    }

    // Priority order matters
    if (isSticker) {
      // TGS animated stickers vs static WebP stickers
      const isAnimatedSticker = isAnimated || doc.mimeType === 'application/x-tgsticker';
      return isAnimatedSticker ? 'sticker_animated' : 'sticker';
    }
    if (isAnimated) return 'gif';   // GIFs stored as looping MP4
    if (isVideo) return 'video';
    if (isVoice) return 'voice';
    if (isAudio) return 'audio';
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
          groupedId: 'groupedId' in msg && msg.groupedId ? msg.groupedId.toString() : null,
        }));
    });

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
