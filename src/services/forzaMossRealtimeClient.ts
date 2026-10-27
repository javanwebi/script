/**
 * A strict adapter to OpenMOSS's official MOSS-TTS-Realtime HTTP session API:
 * POST /tts/session/start
 * GET  /tts/session/{id}/audio        (streamed signed PCM16)
 * POST /tts/session/push              (is_final: true)
 * POST /tts/session/close
 *
 * It assembles an interoperable WAV for the existing FORZA playback contract.
 * Streaming playback in the browser is a separate follow-up integration.
 *
 * Run the protected upstream backend on a CUDA GPU host. FORZA's Railway Node
 * server calls it over authenticated HTTPS. No alternative TTS provider used.
 */
import {randomUUID} from 'node:crypto';

type FetchLike = typeof fetch;
export type MossSpeechOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  onPcmChunk?: (chunk: Uint8Array, sampleRate: number) => void;
};

function validEndpoint(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.username || u.password || u.search || u.hash || !['https:', 'http:'].includes(u.protocol)) return null;
    // Never send customer text or shared secrets over unencrypted public HTTP.
    if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(u.hostname) &&
        !u.hostname.endsWith('.railway.internal')) return null;
    return u;
  } catch { return null; }
}

function pcm16ToWave(pcm: Buffer, rate: number): Buffer {
  const result = Buffer.allocUnsafe(44 + pcm.length);
  result.write('RIFF', 0);
  result.writeUInt32LE(36 + pcm.length, 4);
  result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16); // PCM sub-chunk
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22); // mono
  result.writeUInt32LE(rate, 24);
  result.writeUInt32LE(rate * 2, 28);
  result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34);
  result.write('data', 36);
  result.writeUInt32LE(pcm.length, 40);
  pcm.copy(result, 44);
  return result;
}

export async function synthesizeMossRealtimeWav(
  text: string,
  options: MossSpeechOptions = {},
): Promise<Buffer | null> {
  const env = options.env ?? process.env;
  const base = validEndpoint(String(env.FORZA_TTS_BASE_URL || '').trim());
  const secret = String(env.FORZA_TTS_TOKEN || '').trim();
  const sentence = String(text || '').trim();
  if (!base || !secret || !sentence || sentence.length > 800) return null;

  const timeoutMs = Math.max(5000, Math.min(60000, Number(env.FORZA_TTS_TIMEOUT_MS || '20000') || 20000));
  const controller = new AbortController();
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([controller.signal, timeout, options.signal]) : AbortSignal.any([controller.signal, timeout]);
  const network = options.fetchImpl ?? fetch;
  const sessionId = randomUUID();
  const auth = {Authorization: 'Bearer ' + secret};
  const jsonHeaders = {...auth, 'Content-Type': 'application/json'};
  let started = false;

  try {
    const start = await network(new URL('/tts/session/start', base), {
      method: 'POST', signal, headers: jsonHeaders,
      body: JSON.stringify({
        session_id: sessionId,
        new_turn: true,
        // Server-side reference audio must be a properly licensed Persian male
        // sample mounted on the GPU host; do not pass arbitrary public URLs.
        prompt_audio: String(env.MOSS_TTS_PROMPT_AUDIO || '').trim() || null,
      }),
    });
    if (!start.ok) return null;
    started = true;

    // Launch both at once. The native MOSS server may withhold the final
    // audio chunk until "is_final"; waiting to push until audio completes
    // would deadlock a streaming generation.
    const [stream, pushed] = await Promise.all([
      network(new URL('/tts/session/' + sessionId + '/audio', base), {
        method: 'GET', signal, headers: auth,
      }),
      network(new URL('/tts/session/push', base), {
        method: 'POST', signal, headers: jsonHeaders,
        body: JSON.stringify({session_id: sessionId, text: sentence, is_final: true}),
      }),
    ]);
    if (!pushed.ok || !stream.ok || !stream.body) return null;

    const codec = stream.headers.get('x-audio-codec')?.toLowerCase();
    const channels = Number(stream.headers.get('x-audio-channels'));
    const rate = Number(stream.headers.get('x-audio-sample-rate'));
    if (codec !== 'pcm_s16le' || channels !== 1 || !Number.isInteger(rate) || rate < 16000 || rate > 48000) return null;

    const parts: Buffer[] = [];
    let total = 0;
    const reader = stream.body.getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        if (signal.aborted) return null;
        const data = Buffer.from(next.value);
        total += data.length;
        // Existing FORZA JSON audio transport has a 6MB WAV bound.
        if (total > 5_999_900) return null;
        parts.push(data);
        if (data.length) options.onPcmChunk?.(data, rate);
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (total < 256 || total % 2 !== 0) return null;
    return pcm16ToWave(Buffer.concat(parts, total), rate);
  } catch {
    return null;
  } finally {
    controller.abort(); // abort any leftover audio work or pending native network stream
    if (started) {
      // Cleanup uses its own deadline because the request may have timed out.
      try {
        await network(new URL('/tts/session/close', base), {
          method: 'POST', headers: jsonHeaders,
          signal: AbortSignal.timeout(1500),
          body: JSON.stringify({session_id: sessionId}),
        });
      } catch { /* cleanup best effort */ }
    }
  }
}
