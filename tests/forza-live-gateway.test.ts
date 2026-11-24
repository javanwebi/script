import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { WebSocket, type WebSocket as WebSocketClient } from 'ws';
import { setupForzaLiveGateway } from '../server/ai/forzaLiveGateway.ts';

async function startServer(options: Parameters<typeof setupForzaLiveGateway>[1]) {
  const server = createServer();
  const dispose = setupForzaLiveGateway(server, { enabled: true, ...options });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    server,
    dispose,
    origin,
    url: `ws://127.0.0.1:${address.port}/api/live`,
    async close() {
      dispose();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

type MessageWaiter = {
  predicate: (message: any) => boolean;
  resolve: (message: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const messageState = new WeakMap<WebSocketClient, { messages: any[]; waiters: MessageWaiter[] }>();

function trackMessages(socket: WebSocketClient) {
  const state = { messages: [] as any[], waiters: [] as MessageWaiter[] };
  messageState.set(socket, state);
  socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
    let message: any;
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : Array.isArray(raw) ? Buffer.concat(raw).toString('utf8') : Buffer.from(raw).toString('utf8');
    try { message = JSON.parse(text); } catch { return; }
    const index = state.waiters.findIndex(waiter => waiter.predicate(message));
    if (index >= 0) {
      const [waiter] = state.waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else {
      state.messages.push(message);
    }
  });
}

function waitForMessage(
  socket: WebSocketClient,
  predicate: (message: any) => boolean,
  timeoutMs = 2_000,
): Promise<any> {
  const state = messageState.get(socket);
  if (!state) return Promise.reject(new Error('Socket message tracking was not initialized'));
  const index = state.messages.findIndex(predicate);
  if (index >= 0) return Promise.resolve(state.messages.splice(index, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter: MessageWaiter = {
      predicate,
      resolve,
      reject,
      timer: setTimeout(() => {
        const index = state.waiters.indexOf(waiter);
        if (index >= 0) state.waiters.splice(index, 1);
        reject(new Error('Timed out waiting for FORZA Live message'));
      }, timeoutMs),
    };
    state.waiters.push(waiter);
  });
}
async function openClient(url: string, origin: string, extraHeaders: Record<string, string> = {}): Promise<WebSocketClient> {
  const socket = new WebSocket(url, { headers: { Origin: origin, ...extraHeaders } });
  trackMessages(socket);
  await once(socket, 'open');
  return socket;
}

test('FORZA Live gateway connects to Gemini and bridges continuous audio, text, transcript and interruption events', async () => {
  const receivedInputs: any[] = [];
  let connectOptions: any;
  let providerClosed = false;
  const fakeSession = {
    sendRealtimeInput(input: any) { receivedInputs.push({ kind: 'realtime', input }); },
    sendClientContent(input: any) { receivedInputs.push({ kind: 'client_content', input }); },
    close() { providerClosed = true; },
  };
  const fakeClient: any = {
    live: {
      async connect(options: any) {
        connectOptions = options;
        return fakeSession;
      },
    },
  };
  const app = await startServer({
    getApiKey: () => 'test-only-key',
    createClient: () => fakeClient,
    model: 'gemini-3.8-live',
    voice: 'Charon',
    maxSessionMs: 60_000,
  });

  let client: WebSocketClient | undefined;
  try {
    client = await openClient(app.url, app.origin);
    const connectedPromise = waitForMessage(client, message => message.type === 'connected');
    const connected = await connectedPromise;
    assert.equal(connected.model, 'gemini-3.8-live');
    assert.equal(connected.sampleRate, 24000);
    assert.equal(connected.inputSampleRate, 16000);
    assert.equal(connectOptions.config.responseModalities[0], 'AUDIO');
    assert.equal(connectOptions.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Charon');
    assert.equal('languageCode' in connectOptions.config.speechConfig, false);
    assert.equal(connectOptions.config.realtimeInputConfig.automaticActivityDetection.startOfSpeechSensitivity, 'START_SENSITIVITY_LOW');
    assert.equal(connectOptions.config.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 600);
    assert.deepEqual(connectOptions.config.inputAudioTranscription, {});
    assert.deepEqual(connectOptions.config.outputAudioTranscription, {});

    const pcm = Buffer.alloc(1_024);
    const audio = pcm.toString('base64');
    client.send(JSON.stringify({ type: 'realtime_audio', audio }));
    client.send(JSON.stringify({ type: 'text', text: 'سلام فورزا' }));
    client.send(JSON.stringify({ type: 'audio_stream_end' }));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.match(receivedInputs[0].input.turns[0].parts[0].text, /خوش‌آمدگویی کوتاه/);
    assert.deepEqual(receivedInputs.slice(1, 4), [
      { kind: 'realtime', input: { audio: { data: audio, mimeType: 'audio/pcm;rate=16000' } } },
      { kind: 'client_content', input: { turns: [{ role: 'user', parts: [{ text: 'سلام فورزا' }] }], turnComplete: true } },
      { kind: 'realtime', input: { audioStreamEnd: true } },
    ]);

    const outputAudio = Buffer.from([0, 0, 1, 0, 2, 0]).toString('base64');
    const providerAudioPromise = waitForMessage(client, message => message.type === 'audio_chunk');
    const providerUserTextPromise = waitForMessage(client, message => message.type === 'user_transcript');
    const providerAiTextPromise = waitForMessage(client, message => message.type === 'ai_transcript');
    connectOptions.callbacks.onmessage({
      inputTranscription: { text: 'سلام' },
      outputTranscription: { text: 'سلام، من فورزا هستم.' },
      serverContent: {
        modelTurn: {
          parts: [{
            inlineData: { data: outputAudio, mimeType: 'audio/pcm;rate=24000' },
          }],
        },
      },
    });
    const [audioMessage, userText, aiText] = await Promise.all([
      providerAudioPromise, providerUserTextPromise, providerAiTextPromise,
    ]);
    assert.equal(audioMessage.data, outputAudio);
    assert.equal(audioMessage.mimeType, 'audio/pcm;rate=24000');
    assert.ok(audioMessage.responseId);
    assert.equal(userText.text, 'سلام');
    assert.equal(aiText.text, 'سلام، من فورزا هستم.');

    const interruptedPromise = waitForMessage(client, message => message.type === 'interrupted');
    connectOptions.callbacks.onmessage({ serverContent: { interrupted: true } });
    await interruptedPromise;

    const completePromise = waitForMessage(client, message => message.type === 'turn_complete');
    connectOptions.callbacks.onmessage({ serverContent: { turnComplete: true } });
    await completePromise;
  } finally {
    client?.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    await app.close();
  }
  assert.equal(providerClosed, true, 'Closing the browser call must close the provider session');
});

test('FORZA Live gateway rejects cross-origin and malformed-origin WebSocket upgrades', async () => {
  const app = await startServer({
    getApiKey: () => 'test-only-key',
    createClient: () => { throw new Error('Provider must not be created for a rejected origin'); },
  });
  const rejectedOrigins = ['https://attacker.example', `${app.origin}/not-an-origin`];
  const clients: WebSocket[] = [];
  try {
    for (const origin of rejectedOrigins) {
      const client = new WebSocket(app.url, { headers: { Origin: origin } });
      clients.push(client);
      const [request, response] = await once(client, 'unexpected-response');
      assert.ok(request);
      assert.equal((response as any).statusCode, 403);
    }
  } finally {
    clients.forEach(client => client.terminate());
    await app.close();
  }
});

test('FORZA Live gateway fails closed by default when the server opt-in is missing', async () => {
  const previous = process.env.FORZA_LIVE_ENABLED;
  delete process.env.FORZA_LIVE_ENABLED;
  let providerCreated = false;
  const app = await startServer({
    enabled: undefined,
    getApiKey: () => 'test-only-key',
    createClient: () => { providerCreated = true; throw new Error('must not run'); },
  });
  let client: WebSocketClient | undefined;
  try {
    client = await openClient(app.url, app.origin);
    const fallback = await waitForMessage(client, message => message.type === 'fallback_required');
    assert.equal(fallback.reasonCode, 'disabled');
    assert.equal(providerCreated, false);
  } finally {
    client?.terminate();
    await app.close();
    if (previous === undefined) delete process.env.FORZA_LIVE_ENABLED;
    else process.env.FORZA_LIVE_ENABLED = previous;
  }
});

test('FORZA Live gateway reports missing server credentials without exposing a provider key', async () => {
  let providerCreated = false;
  const app = await startServer({
    getApiKey: () => undefined,
    createClient: () => { providerCreated = true; throw new Error('must not run'); },
  });
  let client: WebSocketClient | undefined;
  try {
    client = await openClient(app.url, app.origin);
    const fallback = await waitForMessage(client, message => message.type === 'fallback_required');
    assert.equal(fallback.reasonCode, 'missing_key');
    assert.equal(typeof fallback.reason, 'string');
    assert.equal(JSON.stringify(fallback).includes('test-only-key'), false);
    assert.equal(providerCreated, false);
  } finally {
    client?.terminate();
    await app.close();
  }
});

test('FORZA Live gateway rate-limits repeated demo sessions from one source IP', async () => {
  const fakeSession = { sendRealtimeInput() {}, sendClientContent() {}, close() {} };
  const fakeClient: any = {
    live: { async connect() { return fakeSession; } },
  };
  const app = await startServer({
    getApiKey: () => 'test-only-key',
    createClient: () => fakeClient,
    maxSessionsPerHourPerIp: 1,
  });
  let first: WebSocketClient | undefined;
  let second: WebSocketClient | undefined;
  try {
    first = await openClient(app.url, app.origin);
    await waitForMessage(first, message => message.type === 'connected');
    const firstClosed = once(first, 'close');
    first.close();
    await firstClosed;

    second = new WebSocket(app.url, { headers: { Origin: app.origin } });
    const [request, response] = await once(second, 'unexpected-response');
    assert.ok(request);
    assert.equal((response as any).statusCode, 429);
  } finally {
    first?.terminate();
    second?.terminate();
    await app.close();
  }
});

test('FORZA Live gateway enforces the global hourly session budget across different IPs', async () => {
  const fakeSession = { sendRealtimeInput() {}, sendClientContent() {}, close() {} };
  const fakeClient: any = {
    live: { async connect() { return fakeSession; } },
  };
  const app = await startServer({
    getApiKey: () => 'test-only-key',
    createClient: () => fakeClient,
    maxSessionsPerHour: 1,
    maxSessionsPerHourPerIp: 60,
  });
  let first: WebSocketClient | undefined;
  let second: WebSocketClient | undefined;
  try {
    first = await openClient(app.url, app.origin, { 'X-Real-IP': '203.0.113.10' });
    await waitForMessage(first, message => message.type === 'connected');
    const firstClosed = once(first, 'close');
    first.close();
    await firstClosed;

    second = new WebSocket(app.url, {
      headers: { Origin: app.origin, 'X-Real-IP': '203.0.113.11' },
    });
    const [request, response] = await once(second, 'unexpected-response');
    assert.ok(request);
    assert.equal((response as any).statusCode, 429);
  } finally {
    first?.terminate();
    second?.terminate();
    await app.close();
  }
});

test('FORZA Live gateway limits text prompts per customer session', async () => {
  const fakeSession = { sendRealtimeInput() {}, sendClientContent() {}, close() {} };
  const fakeClient: any = {
    live: { async connect() { return fakeSession; } },
  };
  const app = await startServer({
    getApiKey: () => 'test-only-key',
    createClient: () => fakeClient,
  });
  let client: WebSocketClient | undefined;
  try {
    client = await openClient(app.url, app.origin);
    await waitForMessage(client, message => message.type === 'connected');
    for (let index = 0; index < 31; index += 1) {
      client.send(JSON.stringify({ type: 'text', text: `پیام آزمایشی ${index}` }));
    }
    const limited = await waitForMessage(client, message => message.type === 'fallback_required');
    assert.equal(limited.reasonCode, 'rate_limited');
  } finally {
    client?.terminate();
    await app.close();
  }
});
