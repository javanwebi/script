export interface ForzaWavFrameStreamStats {
  frames: number;
  totalBytes: number;
}

const DEFAULT_MAX_FRAME_BYTES = 8_000_000;
const DEFAULT_MAX_TOTAL_BYTES = 32_000_000;
const DEFAULT_MAX_FRAMES = 48;

function isWav(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 44 &&
    String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3]) === 'RIFF' &&
    String.fromCharCode(bytes[8],bytes[9],bytes[10],bytes[11]) === 'WAVE';
}

/** Consume uint32-le-length-prefixed WAV frames from a live HTTP response.
 * Frames are delivered immediately; the whole answer is never buffered.
 */
export async function consumeForzaWavFrameStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (wav: Uint8Array, index: number) => void,
  signal?: AbortSignal,
  limits: {
    maxFrameBytes?: number;
    maxTotalBytes?: number;
    maxFrames?: number;
  } = {},
): Promise<ForzaWavFrameStreamStats> {
  const maxFrameBytes = limits.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const maxFrames = limits.maxFrames ?? DEFAULT_MAX_FRAMES;
  const reader = body.getReader();
  let pending = new Uint8Array(0);
  let frames = 0;
  let totalBytes = 0;
  const cancelOnAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort',cancelOnAbort,{once:true});
  try {
    while (true) {
      if (signal?.aborted) throw new Error('forza_tts_aborted');
      const {value,done} = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxTotalBytes) throw new Error('forza_tts_stream_too_large');
      const combined = new Uint8Array(pending.byteLength + value.byteLength);
      combined.set(pending,0);
      combined.set(value,pending.byteLength);
      pending = combined;

      let consumed = 0;
      while (pending.byteLength - consumed >= 4) {
        const length = new DataView(
          pending.buffer,pending.byteOffset + consumed,4
        ).getUint32(0,true);
        if (length < 44 || length > maxFrameBytes)
          throw new Error('forza_tts_invalid_frame_length');
        if (pending.byteLength - consumed < 4 + length) break;
        if (frames >= maxFrames) throw new Error('forza_tts_too_many_frames');
        const wav = pending.slice(consumed + 4,consumed + 4 + length);
        if (!isWav(wav)) throw new Error('forza_tts_invalid_wav_frame');
        onFrame(wav,frames);
        frames++;
        consumed += 4 + length;
      }
      if (consumed) pending = pending.slice(consumed);
    }
    if (signal?.aborted) throw new Error('forza_tts_aborted');
    if (pending.byteLength) throw new Error('forza_tts_truncated_frame');
    if (!frames) throw new Error('forza_tts_empty_stream');
    return {frames,totalBytes};
  } catch (error) {
    await reader.cancel(error).catch(()=>{});
    throw error;
  } finally {
    signal?.removeEventListener('abort',cancelOnAbort);
    reader.releaseLock();
  }
}