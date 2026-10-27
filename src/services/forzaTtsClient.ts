/**
 * Server-only TTS transport. An OpenAI-compatible local engine can serve
 * /v1/audio/speech on a Railway private URL. Never expose its URL/token in Vite.
 *
 * Returns a valid WAV buffer or null; caller chooses the next provider.
 */
export async function synthesizeLocalPersianSpeech(
  text: string,
  options: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {},
): Promise<Buffer | null> {
  const env = options.env ?? process.env;
  const raw = String(env.FORZA_TTS_BASE_URL || '').trim();
  if (!raw || !text.trim()) return null;
  try {
    const base = new URL(raw);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
        base.search || base.hash) return null;
    const timeout = AbortSignal.timeout(3500);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const bearer = String(env.FORZA_TTS_TOKEN || '').trim();
    const response = await (options.fetchImpl ?? fetch)(new URL('/v1/audio/speech', base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? {Authorization: `Bearer ${bearer}`} : {}),
      },
      body: JSON.stringify({
        model: env.FORZA_TTS_MODEL || 'pocket-tts-farsi-v2',
        voice: env.FORZA_TTS_VOICE || 'male_01',
        input: text.slice(0, 1800),
        response_format: 'wav',
      }),
      signal,
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 44 || buffer.length > 6_000_000) return null;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
    return buffer;
  } catch {
    return null;
  }
}
