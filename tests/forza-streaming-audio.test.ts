import test from 'node:test';
import assert from 'node:assert/strict';
import { playForzaStreamingAudio } from '../src/utils/forzaStreamingAudio.ts';

test('progressive FORZA MP3 begins playback before all TTS bytes have arrived', async () => {
  const originals = ['MediaSource', 'URL', 'fetch', 'window'];
  const previous = originals.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
  let streamFinished = false;
  let playedBeforeNetworkFinished = false;
  let blobRevoked = false;

  class BufferMock extends EventTarget {
    updating = false;
    appendBuffer(_buffer: ArrayBuffer) {
      this.updating = true;
      queueMicrotask(() => {
        this.updating = false;
        this.dispatchEvent(new Event('updateend'));
      });
    }
  }
  class SourceMock extends EventTarget {
    static isTypeSupported(type: string) { return type === 'audio/mpeg'; }
    readyState = 'open';
    addSourceBuffer(type: string) {
      assert.equal(type, 'audio/mpeg');
      return new BufferMock();
    }
    endOfStream() {
      this.readyState = 'ended';
      queueMicrotask(() => audio.dispatchEvent(new Event('ended')));
    }
  }
  class AudioMock extends EventTarget {
    src = '';
    preload = '';
    pause() {}
    load() { queueMicrotask(() => source?.dispatchEvent(new Event('sourceopen'))); }
    removeAttribute(name: string) { if (name === 'src') this.src = ''; }
    async play() {
      playedBeforeNetworkFinished = !streamFinished;
      this.dispatchEvent(new Event('playing'));
    }
  }
  let source: SourceMock | null = null;
  const audio = new AudioMock();
  const originalUrl = URL;
  try {
    Object.defineProperty(globalThis, 'MediaSource', { configurable: true, value: class extends SourceMock {
      constructor() { super(); source = this; }
    } });
    Object.defineProperty(globalThis, 'URL', { configurable: true, value: Object.assign(class {}, {
      createObjectURL: () => 'blob:forza-test',
      revokeObjectURL: () => { blobRevoked = true; },
    }) });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (_url: string, init: any) => {
      assert.equal(_url, '/api/ai/tts-stream');
      assert.equal(JSON.parse(init.body).text, 'درود، پاسخ تخصصی فورزا.');
      return {
        ok: true,
        headers: { get: () => 'audio/mpeg' },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([0xff, 0xfb, 0x90, 0x64]));
            setTimeout(() => {
              streamFinished = true;
              controller.enqueue(new Uint8Array([0xff, 0xfb, 0x90, 0x64]));
              controller.close();
            }, 25);
          },
        }),
      };
    } });
    let onPlaying = 0;
    await playForzaStreamingAudio(audio as any, 'درود، پاسخ تخصصی فورزا.', new AbortController().signal, () => onPlaying++);
    assert.equal(onPlaying, 1);
    assert.equal(playedBeforeNetworkFinished, true);
    assert.equal(streamFinished, true);
    assert.equal(blobRevoked, true);
  } finally {
    for (let i = 0; i < originals.length; i++) {
      if (previous[i]) Object.defineProperty(globalThis, originals[i], previous[i]!);
      else Reflect.deleteProperty(globalThis, originals[i]);
    }
    void originalUrl;
  }
});

test('unsupported browsers keep existing TTS fallback available', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'MediaSource');
  try {
    Reflect.deleteProperty(globalThis, 'MediaSource');
    await assert.rejects(
      playForzaStreamingAudio({} as HTMLAudioElement, 'سلام', new AbortController().signal, () => {}),
      /stream_unsupported/,
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'MediaSource', original);
  }
});
