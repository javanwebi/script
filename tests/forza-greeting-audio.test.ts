import test from 'node:test';
import assert from 'node:assert/strict';
import { createForzaGreeting } from '../src/services/forzaGreetingAudio';
import { FORZA_GREETING_TEXT } from '../src/utils/forzaGreeting';

test('VPS without build WAV synthesizes the exact greeting once for concurrent visitors', async () => {
  let calls = 0;
  const wav = Buffer.alloc(48);
  wav.write('RIFF'); wav.write('WAVE', 8);
  const get = createForzaGreeting(async text => {
    calls++; assert.equal(text, FORZA_GREETING_TEXT); return wav;
  }, []);
  const results = await Promise.all([get(), get(), get()]);
  assert.ok(results.every(result => result === wav));
  assert.equal(await get(), wav);
  assert.equal(calls, 1);
});

test('HTML is never accepted as greeting audio and failure does not hammer the worker', async () => {
  let calls = 0;
  const get = createForzaGreeting(async () => { calls++; return Buffer.from('<html>' + 'x'.repeat(80)); }, []);
  await assert.rejects(get(), /invalid_wav/);
  await assert.rejects(get(), /retry_later/);
  assert.equal(calls, 1);
});
