import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createClient, API_ID, API_HASH } from '@/lib/telegram';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const session = await getSession();
    const client = createClient(session.sessionString);
    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({}),
      })
    ) as Api.auth.SentCode;

    session.phone = phone;
    session.phoneCodeHash = result.phoneCodeHash;
    session.sessionString = client.session.save() as unknown as string;
    await session.save();

    await client.disconnect();

    return NextResponse.json({ success: true, type: result.type.className });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
