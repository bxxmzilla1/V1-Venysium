import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';
import { buildInputPeer, EntityType } from '@/lib/peer';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.sessionString) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { rawId, entityType, accessHash, message } = await req.json();

    if (!rawId || !message?.trim()) {
      return NextResponse.json({ error: 'rawId and message required' }, { status: 400 });
    }

    const result = await withClient(session.sessionString, async (client) => {
      const peer = buildInputPeer(entityType as EntityType, rawId, accessHash || '0');
      const sent = await client.sendMessage(peer, { message: message.trim() });
      return {
        id: sent.id,
        message: sent.message,
        date: sent.date,
        out: true,
      };
    });

    return NextResponse.json({ success: true, message: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
