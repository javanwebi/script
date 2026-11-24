import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:http';
import { once } from 'node:events';
import { WebSocket, type WebSocket as WebSocketClient } from 'ws';
import { setupForzaLiveGateway } from '../server/ai/forzaLiveGateway.ts';

async function startServer(options: Parameters<typeof setupForzaLiveGateway>[1]) {
  const server = createServer();
  const dispose = setupForzaLiveGateway(server, options);
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

function waitForMessage(
  socket: WebSocketClient,
  predicate: (message: any) => boolean,
  timeoutMs = 2_000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('Timed out waiting for FORZA Live message'));
    }, timeoutMs);
    const onMessage = (raw: Buffer) => {
      let message: any;
      try { message = JSON.parse(raw.toString('utf8')); } catch { return; }
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

async function openClient(url: string, origin: string): Promise<WebSocketClient> {
  const socket = new WebSocket(url, { headers: { Origin: origin } });
  await once(socket, 'open');
  return socket;
}

test('FORZA Live gateway connects to Gemini and bridges continuous audio, text, transcript and interruption events', async () => {
  const receivedInputs: any[] = [];
  let connectOptions: any;
  let providerClosed = false;
  const fakeSession = {
    sendRealtimeInput(input: any) { receivedInputs.push(input); },
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
    assert.equal(connectOptions.config.inputAudioTranscription.constructor, Object);
    assert.equal(connectOptions.config.outputAudioTranscription.constructor, Object);

    const pcm = Buffer.alloc(1_024);
    const audio = pcm.toString('base64');
    client.send(JSON.stringify({ type: 'realtime_audio', audio }));
    client.send(JSON.stringify({ type: 'text', text: 'سلام فورزا' }));
    client.send(JSON.stringify({ type: 'audio_stream_end' }));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(receivedInputs.slice(0, 3), [
      { audio: { data: audio, mimeType: 'audio/pcm;rate=16000' } },
      { text: 'سلام فورزا' },
      { audioStreamEnd: true },
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

test('FORZA Live gateway rejects cross-origin WebSocket upgrades', async () => {
  const app = await startServer({
    getApiKey: () => 'test-only-key',
    createClient: () => { throw new Error('Provider must not be created for a rejected origin'); },
  });
  const client = new WebSocket(app.url, { headers: { Origin: 'https://attacker.example' } });
  try {
    const [request, response] = await once(client, 'unexpected-response');
    assert.ok(request);
    assert.equal((response as any).statusCode, 403);
  } finally {
    client.terminate();
    await app.close();
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
