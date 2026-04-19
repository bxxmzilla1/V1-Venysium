import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

const API_ID = parseInt(process.env.TELEGRAM_API_ID as string);
const API_HASH = process.env.TELEGRAM_API_HASH as string;

export function createClient(sessionString?: string) {
  const session = new StringSession(sessionString || '');
  return new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
    useWSS: false,
  });
}

export async function withClient<T>(
  sessionString: string | undefined,
  fn: (client: TelegramClient) => Promise<T>
): Promise<T> {
  const client = createClient(sessionString);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

export { API_ID, API_HASH };
