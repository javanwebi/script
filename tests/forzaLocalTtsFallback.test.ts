import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeLocalPersianFallback } from '../src/services/forzaLocalTtsFallback';

test('offline Persian TTS fallback returns a valid WAV for diacritized text', async () => {
  const audio = await synthesizeLocalPersianFallback('سَلام، بِه صَنعَتِ پیش خوش آمَدید.');
  assert.ok(audio.length > 44);
  assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
  assert.equal(audio.toString('ascii', 8, 12), 'WAVE');
});

test('offline Persian TTS rejects blank and overlong text', async () => {
  await assert.rejects(() => synthesizeLocalPersianFallback('   '), /invalid_local_tts_text/);
  await assert.rejects(() => synthesizeLocalPersianFallback('x'.repeat(241)), /invalid_local_tts_text/);
});
