import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { computeCheck } from 'telegram/Password';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { code, password } = await req.json();

    const session = await getSession();

    if (!session.phone || !session.phoneCodeHash) {
      return NextResponse.json({ error: 'No active auth session' }, { status: 400 });
    }

    const client = createClient(session.sessionString);
    await client.connect();

    let needsPassword = false;
    let firstName = '';
    let userId = '';

    try {
      const signInResult = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: session.phone,
          phoneCodeHash: session.phoneCodeHash,
          phoneCode: code,
        })
      );

      if (signInResult instanceof Api.auth.Authorization) {
        const user = signInResult.user as Api.User;
        firstName = user.firstName || '';
        userId = user.id.toString();
      }
    } catch (err: unknown) {
      const error = err as { errorMessage?: string; message?: string };
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        needsPassword = true;
        if (password) {
          const pwdInfo = await client.invoke(new Api.account.GetPassword());
          const srpCheck = await computeCheck(pwdInfo, password);
          const authResult = await client.invoke(
            new Api.auth.CheckPassword({ password: srpCheck })
          );
          if (authResult instanceof Api.auth.Authorization) {
            const user = authResult.user as Api.User;
            firstName = user.firstName || '';
            userId = user.id.toString();
          }
        } else {
          await client.disconnect();
          return NextResponse.json({ needsPassword: true }, { status: 200 });
        }
      } else {
        throw err;
      }
    }

    session.sessionString = client.session.save() as unknown as string;
    session.isAuthenticated = true;
    session.firstName = firstName;
    session.userId = userId;
    await session.save();

    await client.disconnect();

    return NextResponse.json({ success: true, needsPassword, firstName });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
