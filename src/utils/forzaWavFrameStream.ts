/**
 * Decode the private FORZA streaming format: [uint32_le length][complete PCM WAV]
 * repeated in order over one HTTP response. Transport chunks can split at
 * arbitrary byte boundaries, including inside the four-byte length header.
 * No audio is persisted; each frame is passed directly to Web Audio.
 */
export async function readForzaWavFrames(
  response: Response,
  onFrame: (frame: Uint8Array) => void,
): Promise<number> {
  if (!response.ok || !response.body) throw new Error('forza_stream_http_' + response.status);
  if (!(response.headers.get('Content-Type') || '').includes('application/x-forza-wav-frames'))
    throw new Error('forza_stream_wrong_content_type');
  const voice=response.headers.get('X-Forza-Voice');
  if (voice !== 'pocket-farsi-v2' && voice !== 'piper-amir-medium')
    throw new Error('forza_stream_wrong_voice');

  const reader = response.body.getReader();
  let buffered = new Uint8Array(0);
  let expected = -1;
  let frames = 0;
  let transferredBytes = 0;
  let completed = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) { completed = true; break; }
      if (!value?.byteLength) continue;
      transferredBytes += value.byteLength;
      if (transferredBytes > 32_000_000) throw new Error('forza_stream_too_large');
      const combined = new Uint8Array(buffered.length + value.length);
      combined.set(buffered);
      combined.set(value, buffered.length);
      buffered = combined;
      for (;;) {
        if (expected < 0) {
          if (buffered.length < 4) break;
          expected = new DataView(buffered.buffer, buffered.byteOffset, 4).getUint32(0, true);
          buffered = buffered.subarray(4);
          if (expected < 44 || expected > 5_000_000)
            throw new Error('forza_stream_invalid_frame_length');
        }
        if (buffered.length < expected) break;
        const frame = buffered.slice(0, expected);
        buffered = buffered.subarray(expected);
        expected = -1;
        if (frame[0] !== 82 || frame[1] !== 73 || frame[2] !== 70 || frame[3] !== 70 ||
            frame[8] !== 87 || frame[9] !== 65 || frame[10] !== 86 || frame[11] !== 69)
          throw new Error('forza_stream_invalid_wav');
        frames++;
        if (frames > 256) throw new Error('forza_stream_too_many_frames');
        onFrame(frame);
      }
    }
    if (!completed || frames === 0 || expected !== -1 || buffered.byteLength !== 0)
      throw new Error('forza_stream_truncated');
    return frames;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
