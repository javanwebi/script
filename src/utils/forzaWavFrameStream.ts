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

/** Backwards-compatible reader for the original Pocket/Amir full-WAV stream.
 * Nima's live path uses consumeForzaWavFrameStream directly with its own
 * voice identity check and progressive scheduling.
 */
export async function readForzaWavFrames(
  response: Response,
  onFrame: (frame: Uint8Array) => void,
): Promise<number> {
  if (!response.ok || !response.body)
    throw new Error('forza_stream_http_' + response.status);
  if (!(response.headers.get('Content-Type') || '').includes('application/x-forza-wav-frames'))
    throw new Error('forza_stream_wrong_content_type');
  const voice=response.headers.get('X-Forza-Voice');
  if (voice !== 'pocket-farsi-v2' && voice !== 'piper-amir-medium')
    throw new Error('forza_stream_wrong_voice');
  try {
    const result=await consumeForzaWavFrameStream(
      response.body,onFrame,undefined,{maxFrames:256}
    );
    return result.frames;
  } catch (error) {
    const code=error instanceof Error?error.message:'unknown';
    const legacyCode:Record<string,string>={
      forza_tts_truncated_frame:'forza_stream_truncated',
      forza_tts_invalid_frame_length:'forza_stream_invalid_frame_length',
      forza_tts_invalid_wav_frame:'forza_stream_invalid_wav',
      forza_tts_stream_too_large:'forza_stream_too_large',
      forza_tts_too_many_frames:'forza_stream_too_many_frames',
      forza_tts_empty_stream:'forza_stream_truncated',
    };
    throw new Error(legacyCode[code]||code);
  }
}
