import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGisooQwenSessionUpdate,
  mapGisooQwenEvent,
} from '../server/ai/gisooQwenRealtime';

test('Qwen session uses Gisoo direct-realtime PCM and server VAD contract', () => {
  const update = buildGisooQwenSessionUpdate('دستیار فارسی صنعت پیش', 500, 'Andre');
  assert.equal(update.type, 'session.update');
  assert.deepEqual(update.session.output_modalities, ['audio']);
  assert.deepEqual(update.session.audio.input.format, {
    type: 'audio/pcm',
    rate: 16000,
  });
  assert.deepEqual(update.session.audio.output.format, {
    type: 'audio/pcm',
    rate: 24000,
  });
  assert.equal(update.session.audio.output.voice, 'Andre');
  assert.match(update.session.instructions, /مشاور فنی/);
  assert.equal(update.session.audio.input.turn_detection.type, 'server_vad');
  assert.equal(update.session.audio.input.turn_detection.silence_duration_ms, 500);
  assert.equal(update.session.audio.input.turn_detection.interrupt_response, true);
  assert.equal(update.session.reasoning.effort, 'none');
});

test('Qwen audio deltas map to the existing FORZA audio chunk protocol', () => {
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.output_audio.delta', delta: 'AQID' }, 'r-1'),
    [{
      type: 'audio_chunk',
      responseId: 'r-1',
      data: 'AQID',
      mimeType: 'audio/pcm;rate=24000',
    }],
  );
});

test('Qwen transcript deltas map to the existing FORZA transcript protocol', () => {
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.output_audio_transcript.delta', delta: 'سلام' }, 'r-2'),
    [{ type: 'ai_text_chunk', responseId: 'r-2', text: 'سلام' }],
  );
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.output_audio_transcript.done', transcript: 'سلام فورزا' }, 'r-2'),
    [{ type: 'ai_transcript', responseId: 'r-2', text: 'سلام فورزا' }],
  );
});

test('Qwen user transcription and barge-in events map without changing response identity', () => {
  assert.deepEqual(
    mapGisooQwenEvent({
      type: 'conversation.item.input_audio_transcription.delta',
      text: 'سلام',
      stash: ' فورزا',
    }),
    [{ type: 'user_transcript', text: 'سلام فورزا', final: false }],
  );
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'input_audio_buffer.speech_started' }, 'r-3'),
    [{ type: 'interrupted', responseId: 'r-3' }],
  );
});

test('Qwen response completion maps to FORZA turn_complete', () => {
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.done' }, 'r-4'),
    [{ type: 'turn_complete', responseId: 'r-4' }],
  );
});


test('Qwen late completion keeps the provider response identity', () => {
  assert.deepEqual(mapGisooQwenEvent({ type: 'response.done', response: { id: 'old' } }, 'new'), [
    { type: 'turn_complete', responseId: 'old' },
  ]);
  assert.deepEqual(mapGisooQwenEvent({ type: 'response.output_audio.delta', response_id: 'old', delta: 'AQID' }, 'new'), [
    { type: 'audio_chunk', responseId: 'old', data: 'AQID', mimeType: 'audio/pcm;rate=24000' },
  ]);
});

test('Qwen invalid VAD duration uses a finite default', () => {
  assert.equal(buildGisooQwenSessionUpdate('فارسی', NaN).session.audio.input.turn_detection.silence_duration_ms, 500);
});

test('Face-to-face page actually mounts the native Gisoo client without the old speech endpoints', () => {
  const page=readFileSync('src/pages/AiForzaPage.tsx','utf8');
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  assert.match(page,/import\('\.\.\/components\/forza\/ForzaQwenCallExperience'\)/);
  assert.match(client,/\/api\/live\?provider=qwen/);
  assert.match(client,/type:'realtime_audio'/);
  assert.doesNotMatch(client,/\/api\/ai\/(?:stt|forza-speech|consult-stream|forza-live)/);
});

 test('Customer barge-in cancels upstream generation and greeting is not fed back into the mic', () => {
  const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  assert.match(server,/speech_started'\)\{userSpeaking=true;[\s\S]*?send\(\{type:'response.cancel'\}\)/);
  assert.match(client,/if\(!s\.ready\|\|!s\.greeted\|\|micMuted\.current/);
  assert.match(client,/send\(s,\{type:'text',text:greeting\}\);return;/);
 });
 test('Native capture and stable light are enabled for exhibition calls', () => {
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  const worklet=readFileSync('public/forza-runtime/qwen-mic-worklet.js','utf8');
  assert.match(client,/new AudioWorkletNode/);
  assert.match(client,/intensity=\{1\} stableLight/);
  assert.match(worklet,/sampleRate \* 0\.02/);
 });
