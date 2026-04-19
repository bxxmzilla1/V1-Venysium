import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
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
          let photo: string | null = null;

          // Extract entity ID for avatar fetching
          let entityId: string | null = null;
          if (entity && 'id' in entity) {
            entityId = entity.id.toString();
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
            photo,
            entityId,
          };
        });
    });

    return NextResponse.json({ dialogs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
