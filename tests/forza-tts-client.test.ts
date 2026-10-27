import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeLocalPersianSpeech } from '../src/services/forzaTtsClient';

const wav = Buffer.alloc(52);
wav.write('RIFF', 0, 'ascii');
wav.write('WAVE', 8, 'ascii');

test('no local URL means no network call', async () => {
  let calls = 0;
  const result = await synthesizeLocalPersianSpeech('سلام', {
    env: {} as NodeJS.ProcessEnv,
    fetchImpl: (async () => { calls++; throw Error('unexpected'); }) as typeof fetch,
  });
  assert.equal(result, null);
  assert.equal(calls, 0);
});

test('valid voice and input are sent to local API with a secret header', async () => {
  let request: Request | null = null;
  const result = await synthesizeLocalPersianSpeech('سلام صنعت پیش', {
    env: {FORZA_TTS_BASE_URL:'http://pocket-tts.railway.internal:8000',FORZA_TTS_TOKEN:'secret',FORZA_TTS_VOICE:'male_02'},
    fetchImpl: (async (input, init) => {
      request = new Request(input, init);
      return new Response(wav, {status:200, headers:{'Content-Type':'audio/wav'}});
    }) as typeof fetch,
  });
  assert.deepEqual(result, wav);
  assert.equal(request!.url, 'http://pocket-tts.railway.internal:8000/v1/audio/speech');
  assert.equal(request!.headers.get('authorization'), 'Bearer secret');
  const body = await request!.json();
  assert.equal(body.voice, 'male_02');
  assert.equal(body.input, 'سلام صنعت پیش');
});

test('ParSiGo Pocket Farsi v2 API requests audio by generation ID', async () => {
  const requests: string[] = [];
  const result = await synthesizeLocalPersianSpeech('سلام صنعت پیش', {
    env: {
      FORZA_TTS_BASE_URL:'http://pocket-tts.railway.internal:8000',
      FORZA_TTS_PROTOCOL:'parsigo',
      FORZA_TTS_VOICE:'male_hello.wav',
    },
    fetchImpl: (async (input, init) => {
      const req=new Request(input,init);
      requests.push(req.url);
      if(req.url.endsWith('/api/tts')) {
        const body=await req.json();
        assert.equal(body.text,'سلام صنعت پیش');
        assert.equal(body.voice,'male_hello.wav');
        return new Response(JSON.stringify({id:'abc12345',duration:1.2}),{status:200});
      }
      return new Response(new Uint8Array(wav),{status:200});
    }) as typeof fetch,
  });
  assert.deepEqual(result,wav);
  assert.equal(requests.length,2);
  assert.ok(requests[1].endsWith('/api/audio/abc12345'));
});

test('invalid origin and non-WAV audio never return synthesized speech', async () => {
  const deny = await synthesizeLocalPersianSpeech('سلام', {
    env: {FORZA_TTS_BASE_URL:'javascript:alert(1)'},
  });
  assert.equal(deny, null);
  const bad = await synthesizeLocalPersianSpeech('سلام', {
    env:{FORZA_TTS_BASE_URL:'http://tts.railway.internal:8000'},
    fetchImpl: (async () => new Response('not wav')) as typeof fetch,
  });
  assert.equal(bad, null);
});
