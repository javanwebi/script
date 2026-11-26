import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGisooQwenSessionUpdate,
  mapGisooQwenEvent,
} from '../server/ai/gisooQwenRealtime';

test('Qwen session uses Gisoo direct-realtime PCM and server VAD contract', () => {
  const update = buildGisooQwenSessionUpdate('دستیار فارسی صنعت پیش', 1100);
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
  assert.equal(update.session.audio.output.voice, 'Ryan');
  assert.match(update.session.instructions, /پرانرژی/);
  assert.equal(update.session.audio.input.turn_detection.type, 'server_vad');
  assert.equal(update.session.audio.input.turn_detection.silence_duration_ms, 1100);
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
