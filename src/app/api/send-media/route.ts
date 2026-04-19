import { NextRequest, NextResponse } from 'next/server';
import { Api } from 'telegram';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';
import { buildInputPeer, EntityType } from '@/lib/peer';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isAuthenticated || !session.sessionString) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await req.formData();
    const rawId = formData.get('rawId') as string;
    const entityType = (formData.get('entityType') as string || 'user') as EntityType;
    const accessHash = formData.get('accessHash') as string || '0';
    const caption = formData.get('caption') as string || '';
    const files = formData.getAll('files') as File[];

    if (!rawId || files.length === 0) {
      return NextResponse.json({ error: 'rawId and at least one file required' }, { status: 400 });
    }

    const client = createClient(session.sessionString);
    await client.connect();

    try {
      const peer = buildInputPeer(entityType, rawId, accessHash);

      const results = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = Buffer.from(await file.arrayBuffer());
        const isLast = i === files.length - 1;

        // Determine if this is a video or image based on MIME type
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        // GIFs should be sent as document/animation to preserve looping
        const isGif = file.type === 'image/gif';

        const sent = await client.sendFile(peer, {
          file: buffer,
          // Only add caption to the last file in a batch
          caption: isLast ? caption : '',
          // For images/videos let Telegram auto-display; for gif/others force document
          forceDocument: isGif || (!isImage && !isVideo),
          // Pass filename so Telegram knows the type
          attributes: isVideo
            ? [new Api.DocumentAttributeVideo({ duration: 0, w: 0, h: 0 })]
            : undefined,
          workers: 4,
        });

        results.push({
          id: sent.id,
          date: sent.date,
          out: true,
        });
      }

      return NextResponse.json({ success: true, messages: results });
    } finally {
      await client.disconnect();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[send-media]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
