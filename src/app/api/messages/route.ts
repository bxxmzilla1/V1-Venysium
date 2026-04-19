import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';
import { buildInputPeer, EntityType } from '@/lib/peer';

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
          media: msg.media ? msg.media.className : null,
        }));
    });

    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
