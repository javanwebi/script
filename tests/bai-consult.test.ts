import test from 'node:test';
import assert from 'node:assert/strict';
import { BaiConsultError, configuredBaiModel, configuredXkiroModel, providerStreamTimeouts, streamBaiConsult, streamXkiroConsult } from '../server/ai/baiConsult';

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
  await assert.rejects(streamBaiConsult({
    apiKey: 'secret-placeholder', model: 'qwen3.7-flash', query: 'سلام',
    fetchImpl: (async () => fakeStream([
      'data: {"choices":[{"delta":{"content":"ابتدا"}}]}\n\n',
      'data: {"error":{"message":"never log provider tokens"}}\n\n',
    ])) as typeof fetch,
    onDelta: chunk => delivered.push(chunk),
  }), (error:unknown)=>error instanceof BaiConsultError&&error.code==='provider_stream_error');
  assert.deepEqual(delivered, ['ابتدا']);
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
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'xkiro', XKIRO_API_KEY: 'example' }, false), 'qwen/qwen3.5-flash:free');
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'xkiro', XKIRO_API_KEY: 'example', XKIRO_MODEL_DESK: 'qwen/qwen3.8-omni-flash:free' }, false), 'qwen/qwen3.8-omni-flash:free');
  assert.equal(configuredXkiroModel({ FORZA_VOICE_PROVIDER: 'xkiro', XKIRO_API_KEY: 'example' }, true), 'qwen/qwen3.5-flash:free');
  assert.equal(configuredXkiroModel({ FORZA_DESK_PROVIDER: 'bai', XKIRO_API_KEY: 'example' }, false), null);
});

test('xKiro streams OpenAI-compatible SSE through the same FORZA contract', async () => {
  let requestBody: any;
  const chunks: string[] = [];
  const result = await streamXkiroConsult({
    apiKey: 'secret-placeholder',
    model: 'qwen/qwen3.5-flash:free',
    query: 'سلام فورزا',
    fetchImpl: (async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(String(url), 'https://api.xkiro.com/v1/chat/completions');
      assert.equal((options?.headers as Record<string, string>)?.Authorization, 'Bearer secret-placeholder');
      requestBody = JSON.parse(String(options?.body));
      return fakeStream([
        'data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" فورزا"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    }) as typeof fetch,
    onDelta: chunk => chunks.push(chunk),
  });
  assert.deepEqual(chunks, ['سلام', ' فورزا']);
  assert.equal(result.text, 'سلام فورزا');
  assert.equal(requestBody.model, 'qwen/qwen3.5-flash:free');
  assert.equal(requestBody.stream, true);
  assert.equal(requestBody.reasoning_effort, 'none');
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

test('xKiro first-token budget accommodates observed live VPS latency without changing B.AI', () => {
  assert.deepEqual(providerStreamTimeouts('bai', true), { firstTokenMs: 10000, totalMs: 30000 });
  assert.deepEqual(providerStreamTimeouts('bai', false), { firstTokenMs: 15000, totalMs: 45000 });
  assert.deepEqual(providerStreamTimeouts('xkiro', true), { firstTokenMs: 22000, totalMs: 38000 });
  assert.deepEqual(providerStreamTimeouts('xkiro', false), { firstTokenMs: 24000, totalMs: 45000 });
});

test('provider-specific no-reasoning hint is not sent to B.AI or other xKiro models', async () => {
  const bodies: any[] = [];
  const fetchImpl = (async (_url: string | URL | Request, options?: RequestInit) => {
    bodies.push(JSON.parse(String(options?.body)));
    return fakeStream(['data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n', 'data: [DONE]\n\n']);
  }) as typeof fetch;
  for (const [model, stream] of [
    ['qwen3.7-flash', streamBaiConsult],
    ['qwen/qwen3.7-flash:free', streamXkiroConsult],
  ] as const) {
    await stream({
      apiKey: 'secret-placeholder',
      model,
      voice: true,
      query: 'سلام',
      fetchImpl,
      onDelta: () => {},
    });
  }
  assert.equal(bodies.length, 2);
  for (const body of bodies) assert.equal(Object.hasOwn(body, 'reasoning_effort'), false);
});

test('provider [DONE] after finish_reason length never completes a cut-off Persian word',async()=>{
  const chunks:string[]=[];
  await assert.rejects(streamXkiroConsult({
    apiKey:'secret-placeholder',model:'qwen/qwen3.5-flash:free',
    query:'تسمه چیست؟',voice:true,
    fetchImpl:(async()=>fakeStream([
      'data: {"choices":[{"delta":{"content":"تسمه، نواری از جنس لاست"}}]}\\n\\n',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\\n\\n',
      'data: [DONE]\\n\\n',
    ].map(s=>s.replace(/\\\\n/g,'\\n')))) as typeof fetch,
    onDelta:chunk=>chunks.push(chunk),
  }), (err:unknown)=>err instanceof BaiConsultError&&err.code==='provider_output_truncated');
  assert.deepEqual(chunks,['تسمه، نواری از جنس لاست']);
});

test('partial provider EOF without normal finish never silently becomes successful TTS',async()=>{
  await assert.rejects(streamBaiConsult({
    apiKey:'secret-placeholder',model:'qwen3.7-flash',
    query:'تسمه چیست؟',
    fetchImpl:(async()=>fakeStream([
      'data: {"choices":[{"delta":{"content":"تسمه، نواری از جنس لاست"}}]}\\n\\n',
    ].map(s=>s.replace(/\\\\n/g,'\\n')))) as typeof fetch,
    onDelta:()=>{},
  }), (err:unknown)=>err instanceof BaiConsultError&&err.code==='provider_stream_incomplete');
});

test('voice generation budget provides room for complete Persian technical answers',async()=>{
  let tokens=0;
  await streamBaiConsult({
    apiKey:'secret-placeholder',model:'qwen3.7-flash',query:'تسمه چیست؟',voice:true,
    fetchImpl:(async(_url,opts)=>{
      tokens=JSON.parse(String(opts?.body)).max_tokens;
      return fakeStream(['data: {"choices":[{"delta":{"content":"تسمه قطعه‌ای انعطاف‌پذیر برای انتقال نیرو است."}}]}\\n\\n','data: [DONE]\\n\\n'].map(s=>s.replace(/\\\\n/g,'\\n')));
    }) as typeof fetch,
    onDelta:()=>{},
  });
  assert.ok(tokens>=512,'the old 256-token cap truncated Persian responses');
});
