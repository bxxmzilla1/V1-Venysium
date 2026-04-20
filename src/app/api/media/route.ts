import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { createClient } from '@/lib/telegram';
import { getSession } from '@/lib/session';
import { buildInputPeer, EntityType } from '@/lib/peer';
// Loaded lazily so Turbopack doesn't try to statically bundle it
async function getFfmpegPath(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ffmpeg-installer/ffmpeg').path as string;
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return ab;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isAuthenticated || !session.sessionString) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = new URL(req.url);
    const rawId = url.searchParams.get('rawId');
    const entityType = (url.searchParams.get('entityType') || 'user') as EntityType;
    const accessHash = url.searchParams.get('accessHash') || '0';
    const msgId = parseInt(url.searchParams.get('msgId') || '0');
    // quality: 'thumb' | 'medium' | 'preview' | 'full'
    const quality = url.searchParams.get('q') || 'thumb';

    if (!rawId || !msgId) {
      return new NextResponse('rawId and msgId required', { status: 400 });
    }

    const client = createClient(session.sessionString);
    await client.connect();

    // For streaming responses, the client must stay alive until the stream finishes.
    // Set this to false when we hand off disconnect responsibility to the stream.
    let shouldDisconnectInFinally = true;

    try {
      const peer = buildInputPeer(entityType, rawId, accessHash);
      const result = await client.getMessages(peer, { ids: [msgId] });
      const msg = result[0];

      if (!msg || msg instanceof Api.MessageEmpty || !('media' in msg) || !msg.media) {
        return new NextResponse('Media not found', { status: 404 });
      }

      let mimeType = 'image/jpeg';
      let isAnimatedSticker = false;
      let isVideo = false;
      let isGif = false;
      let docRef: Api.Document | null = null;

      if (msg.media instanceof Api.MessageMediaPhoto) {
        mimeType = 'image/jpeg';
      } else if (msg.media instanceof Api.MessageMediaDocument) {
        const doc = msg.media.document;
        if (doc instanceof Api.Document) {
          docRef = doc;
          mimeType = doc.mimeType || 'application/octet-stream';
          if (mimeType === 'application/x-tgsticker') isAnimatedSticker = true;

          for (const attr of doc.attributes) {
            if (attr instanceof Api.DocumentAttributeVideo) isVideo = true;
            if (attr instanceof Api.DocumentAttributeAnimated) isGif = true;
          }
          if (isGif) isVideo = false;
        }
      }

      // ── Animated video preview (q=preview) ──────────────────────────────────
      // Telegram generates a short looping MP4 for every video (VideoSize type='v').
      if (quality === 'preview' && docRef) {
        const animThumb = docRef.videoThumbs?.find(
          (t): t is Api.VideoSize => t instanceof Api.VideoSize && t.type === 'v'
        );
        if (animThumb) {
          const previewResult = await client.downloadMedia(msg, {
            thumb: animThumb as unknown as number,
          }) as Buffer | string;

          let previewBuf: Buffer;
          if (typeof previewResult === 'string') {
            const fs = await import('fs/promises');
            previewBuf = await fs.readFile(previewResult);
          } else {
            previewBuf = previewResult as Buffer;
          }

          if (previewBuf && previewBuf.length > 0) {
            return new NextResponse(bufferToArrayBuffer(previewBuf), {
              status: 200,
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': previewBuf.length.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=604800, immutable',
              },
            });
          }
        }
        // No animated preview — fall through to static thumbnail
      }

      // ── 480p transcode path (q=480p) ────────────────────────────────────────
      // Telegram stream → FFmpeg (stdin→stdout) → browser
      // Uses fragmented MP4 so the browser can start playing immediately.
      if (quality === '480p' && (isVideo || isGif) && docRef) {
        const location = new Api.InputDocumentFileLocation({
          id: docRef.id,
          accessHash: docRef.accessHash,
          fileReference: docRef.fileReference,
          thumbSize: '',
        });

        shouldDisconnectInFinally = false;

        const ffmpegBin = await getFfmpegPath();
        const ffmpeg = spawn(ffmpegBin, [
          '-i', 'pipe:0',                  // read from stdin
          '-vf', 'scale=-2:480',           // scale to 480p height, keep aspect ratio
          '-c:v', 'libx264',
          '-preset', 'ultrafast',          // fastest encode, starts outputting quickly
          '-crf', '28',                    // quality (lower = better, 28 is good for preview)
          '-c:a', 'aac',
          '-b:a', '96k',
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof', // streamable fragmented MP4
          '-f', 'mp4',
          'pipe:1',                        // write to stdout
        ]);

        // Feed Telegram chunks → FFmpeg stdin (runs concurrently with output streaming)
        (async () => {
          try {
            for await (const chunk of client.iterDownload({
              file: location,
              offset: bigInt(0),
              requestSize: 512 * 1024,
            })) {
              if (!ffmpeg.stdin.writable) break;
              ffmpeg.stdin.write(chunk as Buffer);
            }
          } catch {
            // ignore — ffmpeg will error on its own if input stops
          } finally {
            ffmpeg.stdin.end();
            await client.disconnect();
          }
        })();

        // Stream FFmpeg stdout → browser
        const stream480 = new ReadableStream({
          start(controller) {
            ffmpeg.stdout.on('data', (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk));
            });
            ffmpeg.stdout.on('end', () => controller.close());
            ffmpeg.stdout.on('error', (err) => controller.error(err));
            ffmpeg.stderr.on('data', () => {}); // consume stderr to prevent blocking
          },
          cancel() {
            ffmpeg.kill('SIGKILL');
          },
        });

        return new NextResponse(stream480, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'none',        // fragmented MP4 doesn't support range seek
            'Cache-Control': 'no-store',    // don't cache since it's a live transcode
            'X-Quality': '480p',
          },
        });
      }

      // ── Streaming path for full video/GIF (q=full) ──────────────────────────
      // We stream bytes from Telegram → browser as they arrive.
      // The video starts playing as soon as the first chunk lands — no full-download wait.
      if (quality === 'full' && (isVideo || isGif) && docRef) {
        const docSize = Number(docRef.size);

        const location = new Api.InputDocumentFileLocation({
          id: docRef.id,
          accessHash: docRef.accessHash,
          fileReference: docRef.fileReference,
          thumbSize: '',
        });

        // Parse Range header (browsers send this to seek or buffer ahead)
        const rangeHeader = req.headers.get('range');
        let rangeStart = 0;
        let rangeEnd = docSize - 1;
        let isRangeRequest = false;

        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (match) {
            rangeStart = parseInt(match[1]);
            rangeEnd = match[2] ? Math.min(parseInt(match[2]), docSize - 1) : docSize - 1;
            isRangeRequest = true;
          }
        }

        const contentLength = rangeEnd - rangeStart + 1;

        // Telegram CDN requires 4096-byte aligned offsets
        const alignedStart = Math.floor(rangeStart / 4096) * 4096;
        const bytesToSkip = rangeStart - alignedStart;

        // Hand off disconnect responsibility to the stream
        shouldDisconnectInFinally = false;

        const stream = new ReadableStream({
          async start(controller) {
            try {
              let skipped = 0;
              let queued = 0;

              for await (const chunk of client.iterDownload({
                file: location,
                offset: bigInt(alignedStart),
                requestSize: 256 * 1024, // 256 KB per Telegram request
              })) {
                let buf = chunk as Buffer;

                // Drop bytes before the requested range start
                if (skipped < bytesToSkip) {
                  const drop = Math.min(bytesToSkip - skipped, buf.length);
                  buf = buf.subarray(drop);
                  skipped += drop;
                  if (buf.length === 0) continue;
                }

                // Trim to not exceed requested length
                const remaining = contentLength - queued;
                if (buf.length > remaining) buf = buf.subarray(0, remaining);

                controller.enqueue(new Uint8Array(buf));
                queued += buf.length;
                if (queued >= contentLength) break;
              }

              controller.close();
            } catch (err) {
              controller.error(err);
            } finally {
              await client.disconnect();
            }
          },
        });

        const headers: Record<string, string> = {
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        };

        if (isRangeRequest) {
          headers['Content-Range'] = `bytes ${rangeStart}-${rangeEnd}/${docSize}`;
          headers['Content-Length'] = contentLength.toString();
          return new NextResponse(stream, { status: 206, headers });
        }

        headers['Content-Length'] = docSize.toString();
        return new NextResponse(stream, { status: 200, headers });
      }

      // ── Non-streaming path: photos, thumbnails, stickers, audio, docs ───────
      const useThumbnail =
        isAnimatedSticker ||
        quality === 'thumb' ||
        quality === 'preview' ||
        (isVideo && quality !== 'full');

      let downloadParams: { thumb?: number; sizeType?: string } = {};

      if (useThumbnail) {
        downloadParams = { thumb: 0 };
        mimeType = 'image/jpeg';
      } else if (quality === 'medium' && !isGif && !isVideo) {
        downloadParams = { sizeType: 'x' }; // ~800 px
        mimeType = 'image/jpeg';
      }
      // 'full' for photos/audio/docs → no extra params → download full file

      const downloadResult = (await client.downloadMedia(
        msg,
        downloadParams
      )) as Buffer | string;

      let buffer: Buffer;
      if (typeof downloadResult === 'string') {
        const fs = await import('fs/promises');
        buffer = await fs.readFile(downloadResult);
      } else {
        buffer = downloadResult as Buffer;
      }

      if (!buffer || buffer.length === 0) {
        return new NextResponse('Empty media', { status: 404 });
      }

      const totalSize = buffer.length;

      // Basic range support for non-streaming content too
      const rangeHeader = req.headers.get('range');
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1]);
          const end = match[2] ? parseInt(match[2]) : totalSize - 1;
          const chunk = buffer.subarray(start, end + 1);
          return new NextResponse(bufferToArrayBuffer(chunk), {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Content-Length': (end - start + 1).toString(),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=604800, immutable',
            },
          });
        }
      }

      return new NextResponse(bufferToArrayBuffer(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': totalSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      });
    } finally {
      if (shouldDisconnectInFinally) {
        await client.disconnect();
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/media]', message);
    return new NextResponse(`Media error: ${message}`, { status: 500 });
  }
}
