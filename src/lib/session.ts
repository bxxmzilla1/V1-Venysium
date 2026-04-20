import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  sessionString?: string;
  phone?: string;
  phoneCodeHash?: string;
  isAuthenticated?: boolean;
  firstName?: string;
  userId?: string;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'fallback-dev-secret-please-set-SESSION_SECRET-in-vercel-env-32chars!!';

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: 'tgcrm-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
