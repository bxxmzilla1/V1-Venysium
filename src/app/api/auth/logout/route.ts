import { NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';

export async function POST() {
  try {
    const session = await getSession();

    if (session.sessionString) {
      try {
        const client = createClient(session.sessionString);
        await client.connect();
        await client.invoke(new Api.auth.LogOut());
        await client.disconnect();
      } catch {
        // Ignore logout errors, still clear local session
      }
    }

    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
