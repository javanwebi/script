import { readFile } from 'node:fs/promises';
import { FORZA_GREETING_TEXT } from '../utils/forzaGreeting';

function validWav(audio: Buffer): boolean {
  return audio.length > 44 && audio.length <= 5_000_000 &&
    audio.toString('ascii', 0, 4) === 'RIFF' && audio.toString('ascii', 8, 12) === 'WAVE';
}

/** Reuse a build artifact or synthesize once with the existing selected voice. */
export function createForzaGreeting(
  synthesize: (text: string) => Promise<Buffer>,
  files = ['dist/forza-greeting-bootstrap.wav', 'public/forza-greeting-bootstrap.wav'],
) {
  let cached: Buffer | undefined;
  let pending: Promise<Buffer> | undefined;
  let retryAfter = 0;
  return async (): Promise<Buffer> => {
    if (cached) return cached;
    if (pending) return pending;
    if (Date.now() < retryAfter) throw new Error('forza_greeting_retry_later');
    pending = (async () => {
      for (const file of files) {
        const audio = await readFile(file).catch(() => null);
        if (audio && validWav(audio)) return (cached = audio);
      }
      const audio = await synthesize(FORZA_GREETING_TEXT);
      if (!validWav(audio)) throw new Error('forza_greeting_invalid_wav');
      return (cached = audio);
    })();
    try { return await pending; }
    catch (error) { retryAfter = Date.now() + 5000; throw error; }
    finally { pending = undefined; }
  };
}
