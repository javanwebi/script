import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseForzaVoiceStart } from '../src/utils/forzaVoiceStartup';

function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}

test('ready voice audio starts while streaming has yet to start', async () => {
  const started = pending<void>();
  const finished = pending<boolean>();
  const file = pending<{audioBase64?:string}>();
  const choice = chooseForzaVoiceStart(started.promise, finished.promise, file.promise);
  file.resolve({audioBase64:'data:audio/wav;base64,AA=='});
  assert.deepEqual(await choice, {kind:'audio', audioUrl:'data:audio/wav;base64,AA=='});
});

test('streamed speech begins before completion of an alternate audio request', async () => {
  const started = pending<void>();
  const finished = pending<boolean>();
  const file = pending<{audioBase64?:string}>();
  const choice = chooseForzaVoiceStart(started.promise, finished.promise, file.promise);
  started.resolve();
  assert.deepEqual(await choice,{kind:'stream'});
});

test('a quickly failed stream waits for the already pending alternate voice', async () => {
  const started = pending<void>();
  const finished = pending<boolean>();
  const file = pending<{audioBase64?:string}>();
  const choice = chooseForzaVoiceStart(started.promise,finished.promise,file.promise);
  finished.resolve(false);
  await Promise.resolve();
  file.resolve({audioBase64:'data:audio/mpeg;base64,AA=='});
  assert.deepEqual(await choice,{kind:'audio',audioUrl:'data:audio/mpeg;base64,AA=='});
});

test('unavailable TTS does not wait for the stream after browser fallback is ready', async () => {
  const started = pending<void>();
  const finished = pending<boolean>();
  const file = pending<{audioBase64?:string;useClientSpeech?:boolean}>();
  const choice = chooseForzaVoiceStart(started.promise,finished.promise,file.promise);
  file.resolve({useClientSpeech:true});
  assert.deepEqual(await choice,{kind:'browser'});
});
