import test from 'node:test';
import assert from 'node:assert/strict';
import { BaiConsultError, configuredBaiModel, configuredXkiroModel, streamBaiConsult, streamXkiroConsult } from '../server/ai/baiConsult';

function fakeStream(parts: string[], status = 200, contentType = 'text/event-stream') {
  const chunks = parts.map(p => new TextEncoder().encode(p));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'Content-Type': contentType } });
}

test('B.AI is opt-in and cannot run without a key', () => {
  assert.equal(configuredBaiModel({}, false), null);
  assert.equal(configuredBaiModel({ FORZA_DESK_PROVIDER: 'bai' }, false), null);
  assert.equal(configuredBaiModel({ FORZA_DESK_PROVIDER: 'bai', BAI_API_KEY: 'example' }, false), 'qwen3.7-flash');
  assert.equal(configuredBaiModel({ FORZA_DESK_PROVIDER: 'bai', BAI_API_KEY: 'example', BAI_MODEL_DESK: 'mimo-v2.5' }, false), 'mimo-v2.5');
  assert.equal(configuredBaiModel({ FORZA_DESK_PROVIDER: 'bai', BAI_API_KEY: 'example' }, true), null);
  assert.equal(configuredBaiModel({ FORZA_VOICE_PROVIDER: 'bai', BAI_API_KEY: 'example' }, true), 'qwen3.7-flash');
});

test('B.AI streams partial SSE frames into existing FORZA text-chunk contract', async () => {
  const chunks: Array<{ chunk: string; textSoFar: string }> = [];
  let requestBody: any;
  const fetchImpl = (async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(String(url), 'https://api.b.ai/v1/chat/completions');
    assert.equal((options?.headers as Record<string, string>)?.Authorization, 'Bearer secret-placeholder');
    requestBody = JSON.parse(String(options?.body));
    return fakeStream([
      'data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"، خوبی"}}]',
      '}\n\ndata: [DONE]\n\n',
    ]);
  }) as typeof fetch;
  const result = await streamBaiConsult({
    apiKey: 'secret-placeholder',
    model: 'qwen3.7-flash',
    query: 'چطور تسمه انتخاب کنم؟',
    history: [{ role: 'user', text: 'تسمه SPA' }, { role: 'model', text: 'ابعاد را بفرمایید' }],
    voice: false,
    catalogContext: 'کاتالوگ صنعت پیش',
    fetchImpl,
    onDelta: (chunk, textSoFar) => chunks.push({ chunk, textSoFar }),
  });
  assert.deepEqual(chunks, [
    { chunk: 'سلام', textSoFar: 'سلام' },
    { chunk: '، خوبی', textSoFar: 'سلام، خوبی' },
  ]);
  assert.equal(result.text, 'سلام، خوبی');
  assert.equal(requestBody.stream, true);
  assert.equal(requestBody.messages[0].role, 'system');
  assert.equal(requestBody.messages.at(-1).role, 'user');
  assert.equal(requestBody.messages[1].role, 'user');
  assert.equal(requestBody.messages[2].role, 'assistant');
  assert.equal(requestBody.model, 'qwen3.7-flash');
});

test('provider HTTP 429 signals a safe fallback without returning a private body', async () => {
  await assert.rejects(
    streamBaiConsult({
      apiKey: 'secret-placeholder', model: 'qwen3.7-flash', query: 'تسمه', voice: true,
      onDelta: () => {},
      fetchImpl: (async () => new Response('sensitive-provider-body', { status: 429 })) as typeof fetch,
    }),
    (error: unknown) => error instanceof BaiConsultError &&
      error.code === 'http_429' && !error.message.includes('sensitive'),
  );
});

test('a partially delivered completion is not replayed on an upstream error', async () => {
  const delivered: string[] = [];
  const result = await streamBaiConsult({
    apiKey: 'secret-placeholder', model: 'qwen3.7-flash', query: 'سلام',
    fetchImpl: (async () => fakeStream([
      'data: {"choices":[{"delta":{"content":"ابتدا"}}]}\n\n',
      'data: {"error":{"message":"never log provider tokens"}}\n\n',
    ])) as typeof fetch,
    onDelta: chunk => delivered.push(chunk),
  });
  assert.deepEqual(delivered, ['ابتدا']);
  assert.equal(result.text, 'ابتدا');
});

test('reject an empty answer so the existing Gemini fallback remains available', async () => {
  await assert.rejects(streamBaiConsult({
    apiKey: 'secret-placeholder', model: 'qwen3.7-flash', query: 'سلام',
    fetchImpl: (async () => fakeStream(['data: [DONE]\n\n'])) as typeof fetch,
    onDelta: () => {},
  }), (error: unknown) => error instanceof BaiConsultError && error.code === 'empty_completion');
});


test('xKiro is opt-in, uses the exact free Qwen model ID, and requires its own key', () => {
  assert.equal(configuredXkiroModel({}, false), null);
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'xkiro' }, false), null);
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'xkiro', XKIRO_API_KEY: 'example' }, false), 'qwen/qwen3.7-flash:free');
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'xkiro', XKIRO_API_KEY: 'example', XKIRO_MODEL_DESK: 'qwen/qwen3.8-omni-flash:free' }, false), 'qwen/qwen3.8-omni-flash:free');
  assert.equal(configuredXkiroModel({ FORZA_VOICE_PROVIDER: 'xkiro', XKIRO_API_KEY: 'example' }, true), 'qwen/qwen3.7-flash:free');
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'bai', XKIRO_API_KEY: 'example' }, false), null);
});

test('xKiro streams OpenAI-compatible SSE through the same FORZA contract', async () => {
  let requestBody: any;
  const chunks: string[] = [];
  const result = await streamXkiroConsult({
    apiKey: 'secret-placeholder',
    model: 'qwen/qwen3.7-flash:free',
    query: 'سلام فورزا',
    fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(String(url), 'https://api.xkiro.com/v1/chat/completions');
      assert.equal((options?.headers as Record<string, string>)?.Authorization, 'Bearer secret-placeholder');
      requestBody = JSON.parse(String(options?.body));
      return fakeStream([
        'data: {"choices":[{"delta":{"content":"سلام"}}]}\\n\\n',
        'data: {"choices":[{"delta":{"content":" فورزا"}}]}\\n\\n',
        'data: [DONE]\\n\\n',
      ]);
    }) as typeof fetch,
    onDelta: chunk => chunks.push(chunk),
  });
  assert.deepEqual(chunks, ['سلام', ' فورزا']);
  assert.equal(result.text, 'سلام فورزا');
  assert.equal(requestBody.model, 'qwen/qwen3.7-flash:free');
  assert.equal(requestBody.stream, true);
});

test('provider error code is preserved without logging provider response bodies', async () => {
  await assert.rejects(streamXkiroConsult({
    apiKey: 'secret-placeholder',
    model: 'qwen/qwen3.7-flash:free',
    query: 'سلام',
    fetchImpl: (async () => new Response(JSON.stringify({
      error: { code: 'insufficient_user_quota', message: 'private provider details' },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })) as typeof fetch,
    onDelta: () => {},
  }), (error: unknown) => error instanceof BaiConsultError &&
    error.code === 'http_400_insufficient_user_quota' &&
    !error.message.includes('private provider details'));
});
