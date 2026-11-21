export interface ForzaNimaWavFrameStats {
  frames: number;
  bytes: number;
  firstFrameMs: number;
  totalMs: number;
}

const MAX_FRAME_BYTES = 8_000_000;
const MAX_TOTAL_BYTES = 32_000_000;

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (!left.length) return right.slice();
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left, 0);
  joined.set(right, left.length);
  return joined;
}

function isStandaloneWav(value: Uint8Array): boolean {
  return value.byteLength >= 44 &&
    String.fromCharCode(value[0], value[1], value[2], value[3]) === 'RIFF' &&
    String.fromCharCode(value[8], value[9], value[10], value[11]) === 'WAVE';
}

/**
 * Consume uint32-le length-prefixed standalone WAV frames from the private
 * Nima stream. Each complete frame is handed to the player immediately;
 * the entire response is never buffered in browser memory.
 */
export async function consumeForzaNimaWavFrames(
  body: ReadableStream<Uint8Array>,
  onFrame: (wav: Uint8Array) => void,
  signal?: AbortSignal,
): Promise<ForzaNimaWavFrameStats> {
  const reader = body.getReader();
  const startedAt = performance.now();
  let buffer = new Uint8Array(0);
  let frames = 0;
  let bytes = 0;
  let firstFrameMs = 0;
  let receivedBytes = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    while (true) {
      if (signal?.aborted) throw new Error('forza_nima_stream_aborted');
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_TOTAL_BYTES) throw new Error('forza_nima_stream_too_large');
      buffer = concatBytes(buffer, value);

      while (buffer.byteLength >= 4) {
        const length = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0, true);
        if (length < 44 || length > MAX_FRAME_BYTES) {
          throw new Error('forza_nima_stream_invalid_frame_length');
        }
        if (buffer.byteLength < 4 + length) break;

        const wav = buffer.slice(4, 4 + length);
        if (!isStandaloneWav(wav)) throw new Error('forza_nima_stream_invalid_wav');
        onFrame(wav);
        frames += 1;
        bytes += length;
        if (frames === 1) firstFrameMs = Math.round(performance.now() - startedAt);
        buffer = buffer.slice(4 + length);
      }
    }

    if (buffer.byteLength !== 0) throw new Error('forza_nima_stream_truncated_frame');
    if (frames === 0) throw new Error('forza_nima_stream_empty');
    return {
      frames,
      bytes,
      firstFrameMs,
      totalMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
