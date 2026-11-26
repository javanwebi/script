import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGisooQwenSessionUpdate,
  classifyGisooRealtimeError,
  mapGisooQwenEvent,
  resolveGisooQwenVoice,
} from '../server/ai/gisooQwenRealtime';
import { searchForzaRealtimeCatalog } from '../server/ai/forzaRealtimeCatalog';
import type { Product } from '../src/types';

test('Qwen session uses Gisoo direct-realtime PCM and server VAD contract', () => {
  const update = buildGisooQwenSessionUpdate('دستیار فارسی صنعت پیش', 500, 'Raymond');
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
  assert.equal(update.session.audio.output.voice, 'Raymond');
  assert.match(update.session.instructions, /مشاور ارشد مهندسی/);
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


test('recoverable Gisoo flood errors do not tear down an established realtime session', () => {
  assert.equal(classifyGisooRealtimeError('flood', true), 'recoverable');
  assert.equal(classifyGisooRealtimeError('rate_limit_exceeded', true), 'recoverable');
  assert.equal(classifyGisooRealtimeError('session_closed', true), 'fatal');
  assert.equal(classifyGisooRealtimeError('server_restart', true), 'fatal');
  assert.equal(classifyGisooRealtimeError('insufficient_credit', true), 'fatal');
  assert.equal(classifyGisooRealtimeError('flood', false), 'fatal');
  assert.equal(classifyGisooRealtimeError('response_cancel_not_active', true), 'ignore');
  assert.equal(classifyGisooRealtimeError('conversation_already_has_active_response', true), 'active_response');
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  assert.match(client,/m\.type==='provider_error'/);
  assert.match(client,/اتصال برقرار است/);
});


test('Qwen realtime session exposes the read-only Sanat Pish catalogue tool and richer advice budget', () => {
  const update = buildGisooQwenSessionUpdate('دستیار فارسی صنعت پیش', 500, 'Ryan');
  assert.equal(update.session.audio.output.voice, 'Ryan');
  assert.equal(update.session.max_output_tokens, 1536);
  assert.equal(update.session.tools[0].type, 'function');
  assert.equal(update.session.tools[0].name, 'search_sanatpish_catalog');
  assert.deepEqual(update.session.tools[0].parameters.required, ['query']);
  assert.match(update.session.instructions, /مشاور ارشد مهندسی/);
  assert.match(update.session.instructions, /search_sanatpish_catalog/);
  assert.match(update.session.instructions, /۷۰ تا ۱۳۰ کلمه/);
});

test('live catalogue lookup returns real family/SKU metadata without commercial fields', () => {
  const products = [{
    code: 'BEARING-FAMILY',
    name: 'بلبرینگ شیار عمیق',
    brand: 'SKF',
    categorySlug: 'bearings',
    categoryName: 'بلبرینگ',
    subcategory: 'شیار عمیق',
    technicalSpecs: [{ key: 'نوع', value: 'شیار عمیق' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 99,
    inquiryOnly: true,
    images: ['/storage/products/catalog/bearing-family.webp'],
    active: true,
    variants: [
      { code: '6205-2RS', name: 'بلبرینگ 6205 2RS', size: '25×52×15', price: 100, stock: 10, active: true },
      { code: '6206-ZZ', name: 'بلبرینگ 6206 ZZ', size: '30×62×16', price: 200, stock: 20, active: true },
    ],
  }] as unknown as Product[];

  const result = searchForzaRealtimeCatalog(products, 'بلبرینگ می‌خواهم', 6);
  assert.equal(result.success, true);
  assert.equal(result.familyCount, 1);
  assert.equal(result.results[0].code, 'BEARING-FAMILY');
  assert.equal(result.results[0].variants.length, 2);
  assert.equal(result.results[0].variants[0].code, '6205-2RS');
  assert.equal(result.results[0].link, '/product/BEARING-FAMILY');
  assert.equal(JSON.stringify(result).includes('"price"'), false);
  assert.equal(JSON.stringify(result).includes('"stock"'), false);
});

test('native Gisoo server executes catalogue function calls and returns tool output', () => {
  const server = readFileSync('server/ai/gisooQwenRealtime.ts', 'utf8');
  const app = readFileSync('server.ts', 'utf8');
  assert.match(server, /response\.function_call_arguments\.done/);
  assert.match(server, /function_call_output/);
  assert.match(server, /type:'catalog_results'/);
  assert.match(app, /connectGisooQwenRealtime\(clientWs, FORZA_SYSTEM_INSTRUCTION, searchForzaLiveCatalog\)/);
});

test('live call renders catalogue product cards and does not disconnect on a twelve-second audio queue', () => {
  const client = readFileSync('src/components/forza/ForzaQwenCallExperience.tsx', 'utf8');
  assert.match(client, /m\.type==='catalog_results'/);
  assert.match(client, /نتایج کاتالوگ صنعت پیش/);
  assert.match(client, /href=\{family\.link\}/);
  assert.match(client, /s\.next-ctx\.currentTime>90/);
  assert.doesNotMatch(client, /s\.next-ctx\.currentTime>12/);
  assert.match(client, /useState\('Raymond'\)/);
});


test('legacy Andre selection is migrated to the professional Raymond voice', () => {
  assert.equal(resolveGisooQwenVoice(undefined), 'Raymond');
  assert.equal(resolveGisooQwenVoice('Andre'), 'Raymond');
  assert.equal(resolveGisooQwenVoice('Ryan'), 'Raymond');
  assert.equal(resolveGisooQwenVoice('Raymond'), 'Raymond');
  assert.equal(resolveGisooQwenVoice('Tina'), 'Tina');
  assert.equal(resolveGisooQwenVoice('unsupported-voice'), 'Raymond');
});

test('catalogue cards retain visible products during follow-up speech and expose direct SKU links', () => {
  const client = readFileSync('src/components/forza/ForzaQwenCallExperience.tsx', 'utf8');
  const start = client.indexOf("if(m.type==='speech_started')");
  const end = client.indexOf("if(m.type==='speech_stopped')", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(client.slice(start, end), /setCatalogResults|setCatalogQuery/);
  assert.match(client, /href=\{'\/direct-product\/'\+encodeURIComponent\(variant\.code\)\}/);
  assert.match(client, /useState\('Raymond'\)/);
});
