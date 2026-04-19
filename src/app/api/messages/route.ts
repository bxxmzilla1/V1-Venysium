import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.sessionString) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(req.url);
    const peerId = url.searchParams.get('peerId');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!peerId) {
      return NextResponse.json({ error: 'peerId required' }, { status: 400 });
    }

    const messages = await withClient(session.sessionString, async (client) => {
      const result = await client.getMessages(peerId, { limit });

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
