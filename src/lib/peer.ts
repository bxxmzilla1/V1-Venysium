import { Api } from 'telegram';
import bigInt from 'big-integer';

export type EntityType = 'user' | 'chat' | 'channel';

export function buildInputPeer(
  entityType: EntityType,
  rawId: string,
  accessHash: string
): Api.TypeInputPeer {
  const id = bigInt(rawId);
  const hash = bigInt(accessHash);

  switch (entityType) {
    case 'user':
      return new Api.InputPeerUser({ userId: id, accessHash: hash });
    case 'chat':
      return new Api.InputPeerChat({ chatId: id });
    case 'channel':
      return new Api.InputPeerChannel({ channelId: id, accessHash: hash });
  }
}
