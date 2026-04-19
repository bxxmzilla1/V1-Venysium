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
    const search = url.searchParams.get('search') || '';

    const contacts = await withClient(session.sessionString, async (client) => {
      const result = await client.invoke(new Api.contacts.GetContacts({ hash: bigInt(0) }));

      if (!(result instanceof Api.contacts.Contacts)) {
        return [];
      }

      return result.users
        .filter((u): u is Api.User => u instanceof Api.User)
        .filter((u) => {
          if (!search) return true;
          const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
          const username = (u.username || '').toLowerCase();
          return name.includes(search.toLowerCase()) || username.includes(search.toLowerCase());
        })
        .map((u) => ({
          id: u.id.toString(),
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          username: u.username || '',
          phone: u.phone || '',
          isBot: u.bot || false,
        }));
    });

    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
