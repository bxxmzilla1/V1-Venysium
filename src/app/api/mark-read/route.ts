import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';
import { buildInputPeer, EntityType } from '@/lib/peer';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.sessionString) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { rawId, entityType, accessHash, maxId } = await req.json();

    if (!rawId) {
      return NextResponse.json({ error: 'rawId required' }, { status: 400 });
    }

    await withClient(session.sessionString, async (client) => {
      const peer = buildInputPeer(entityType as EntityType, rawId, accessHash || '0');

      if (entityType === 'channel') {
        // Channels use a different read method
        const channelPeer = peer as unknown as Api.InputPeerChannel;
        await client.invoke(
          new Api.channels.ReadHistory({
            channel: new Api.InputChannel({
              channelId: channelPeer.channelId,
              accessHash: channelPeer.accessHash,
            }),
            maxId: maxId || 0,
          })
        );
      } else {
        // Users and basic groups
        await client.invoke(
          new Api.messages.ReadHistory({
            peer,
            maxId: maxId || 0,
          })
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Don't fail hard — marking read is best-effort
    return NextResponse.json({ success: false, error: message });
  }
}
