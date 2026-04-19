import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { getSession } from '@/lib/session';
import { withClient } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.sessionString) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';

    const dialogs = await withClient(session.sessionString, async (client) => {
      const result = await client.getDialogs({ limit: 100 });

      return result
        .filter((dialog) => {
          if (!search) return true;
          return dialog.name?.toLowerCase().includes(search.toLowerCase());
        })
        .slice(0, limit)
        .map((dialog) => {
          const entity = dialog.entity;

          // Determine entity type and extract raw ID + access hash
          // so we can reconstruct InputPeer in subsequent API calls
          let entityType: 'user' | 'chat' | 'channel' = 'user';
          let rawId = '0';
          let accessHash = '0';

          if (entity instanceof Api.User) {
            entityType = 'user';
            rawId = entity.id.toString();
            accessHash = entity.accessHash?.toString() || '0';
          } else if (entity instanceof Api.Chat) {
            entityType = 'chat';
            rawId = entity.id.toString();
            accessHash = '0';
          } else if (entity instanceof Api.Channel) {
            entityType = 'channel';
            rawId = entity.id.toString();
            accessHash = entity.accessHash?.toString() || '0';
          }

          return {
            id: dialog.id?.toString() || '',
            name: dialog.name || 'Unknown',
            unreadCount: dialog.unreadCount || 0,
            lastMessage: dialog.message?.message || '',
            lastMessageDate: dialog.date || 0,
            isUser: dialog.isUser,
            isGroup: dialog.isGroup,
            isChannel: dialog.isChannel,
            // Entity resolution fields
            entityType,
            rawId,
            accessHash,
          };
        });
    });

    return NextResponse.json({ dialogs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
