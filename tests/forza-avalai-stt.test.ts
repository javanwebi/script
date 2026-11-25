import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ForzaAvalaiSttError,
  transcribeForzaAvalaiAudio,
} from '../server/ai/forzaAvalaiStt';

const AUDIO = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x01]).toString('base64');

test('AvalAI GPT-Transcribe sends a bounded Persian WebM recording with industrial context', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({ text: 'بلبرینگ 6203 ZZ برای خط تولید' });
  };

  const result = await transcribeForzaAvalaiAudio(AUDIO, {
    apiKey: 'private-test-key',
    audioMimeType: 'audio/webm;codecs=opus',
    fetchImpl,
  });

  assert.equal(requestUrl, 'https://api.avalai.ir/v1/audio/transcriptions');
  assert.equal(requestInit?.method, 'POST');
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer private-test-key');
  const form = requestInit?.body as FormData;
  assert.equal(form.get('model'), 'gpt-transcribe');
  assert.equal(form.get('response_format'), 'json');
  assert.equal(form.get('stream'), 'true');
  assert.equal(form.get('languages'), 'fa');
  assert.match(String(form.get('prompt')), /بلبرینگ/);
  assert.equal((form.get('file') as Blob).type, 'audio/webm');
  assert.equal(result.text, 'بلبرینگ 6203 ZZ برای خط تولید');
  assert.equal(result.model, 'gpt-transcribe');
  assert.ok(result.elapsedMs >= 0);
});

test('streamed AvalAI transcript deltas are completed by the final transcript event', async () => {
  const encoder = new TextEncoder();
  const events = [
    { type: 'transcript.text.delta', delta: 'برای خط تولید ' },
    { type: 'transcript.text.delta', delta: 'تسمه تایمینگ می‌خواهم' },
    { type: 'transcript.text.done', text: 'برای خط تولید تسمه تایمینگ می‌خواهم' },
  ];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n'));
      }
      controller.close();
    },
  });
  const fetchImpl: typeof fetch = async () => new Response(body, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });

  const result = await transcribeForzaAvalaiAudio(AUDIO, {
    apiKey: 'private-test-key',
    fetchImpl,
  });
  assert.equal(result.text, 'برای خط تولید تسمه تایمینگ می‌خواهم');
});

test('AvalAI STT fails closed for missing credentials and malformed audio', async () => {
  await assert.rejects(
    transcribeForzaAvalaiAudio(AUDIO, { apiKey: '' }),
    (error: unknown) => error instanceof ForzaAvalaiSttError && error.code === 'avalai_stt_key_missing',
  );
  await assert.rejects(
    transcribeForzaAvalaiAudio('not-base64!', { apiKey: 'private-test-key' }),
    (error: unknown) => error instanceof ForzaAvalaiSttError && error.code === 'avalai_stt_invalid_audio',
  );
});

test('AvalAI STT preserves provider rate-limit status for the Diba fallback decision', async () => {
  const fetchImpl: typeof fetch = async () => new Response('rate limited', { status: 429 });
  await assert.rejects(
    transcribeForzaAvalaiAudio(AUDIO, { apiKey: 'private-test-key', fetchImpl }),
    (error: unknown) => error instanceof ForzaAvalaiSttError &&
      error.code === 'avalai_stt_http_429' && error.status === 429,
  );
});
