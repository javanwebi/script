import { spawn } from 'node:child_process';

const MAX_TEXT_LENGTH = 240;
const MAX_AUDIO_BYTES = 4_000_000;

/** Offline Persian TTS fallback used only when browser-local Piper Amir is not ready. */
export function synthesizeLocalPersianFallback(text: string, timeoutMs = 3500): Promise<Buffer> {
  const phrase = String(text || '').trim();
  if (!phrase || phrase.length > MAX_TEXT_LENGTH) {
    return Promise.reject(new Error('invalid_local_tts_text'));
  }

  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(process.env.FORZA_ESPEAK_BINARY || 'espeak-ng', [
        '-v', 'fa', '-s', '190', '-p', '40', '-a', '180', '--stdout', '--stdin',
      ], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    } catch {
      reject(new Error('local_tts_unavailable'));
      return;
    }

    const chunks: Buffer[] = [];
    let byteLength = 0;
    let settled = false;
    const finish = (error?: Error, audio?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (audio) resolve(audio);
      else reject(new Error('local_tts_empty_audio'));
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('local_tts_timeout'));
    }, Math.max(250, timeoutMs));

    child.stdout.on('data', (chunk: Buffer) => {
      byteLength += chunk.length;
      if (byteLength > MAX_AUDIO_BYTES) {
        child.kill('SIGKILL');
        finish(new Error('local_tts_audio_too_large'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    child.once('error', () => finish(new Error('local_tts_unavailable')));
    child.once('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error('local_tts_failed'));
        return;
      }
      const audio = Buffer.concat(chunks);
      if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' ||
          audio.toString('ascii', 8, 12) !== 'WAVE') {
        finish(new Error('local_tts_invalid_wav'));
        return;
      }
      finish(undefined, audio);
    });
    child.stdin.once('error', () => {});
    child.stdin.end(phrase);
  });
}
