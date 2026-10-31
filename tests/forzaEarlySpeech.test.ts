import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forzaEarlyStableClause, forzaEarlySpeechRemainder } from '../src/utils/forzaEarlySpeech.ts';

test('wait for a complete Persian sentence, not an SSE token fragment', () => {
  assert.equal(forzaEarlyStableClause('برای انتخاب'), null);
  assert.equal(forzaEarlyStableClause('برای انتخاب تسمه مناسب،'), null);
  assert.equal(forzaEarlyStableClause('برای انتخاب تسمه مناسب، کد را'), null);
  assert.equal(
    forzaEarlyStableClause('برای انتخاب تسمه مناسب، کد روی قطعه را بفرمایید. سپس اندازه را بررسی می‌کنم.'),
    'برای انتخاب تسمه مناسب، کد روی قطعه را بفرمایید.'
  );
});

test('ignore decimal separators, preserve industrial product codes', () => {
  const text = 'برای کد SPA-1250 با عرض 12.7 میلی‌متر اطلاعات لازم است. لطفاً شماره دستگاه را بفرمایید.';
  assert.equal(forzaEarlyStableClause(text),
    'برای کد SPA-1250 با عرض 12.7 میلی‌متر اطلاعات لازم است.');
});

test('avoid short greeting and do not speak missing or unfinished text', () => {
  assert.equal(forzaEarlyStableClause('سلام. اکنون جزئیات را بفرمایید.'), null);
  assert.equal(forzaEarlyStableClause('اطلاعات بیشتر در حال دریافت است'), null);
  assert.equal(forzaEarlyStableClause(''), null);
});

test('split first stable clause and final answer without repeating or losing words', () => {
  const answer = 'لطفاً کد فنی تسمه را بفرمایید. سپس سازگاری با دستگاه را بررسی می‌کنم.';
  const prefix = forzaEarlyStableClause(answer);
  assert.ok(prefix);
  assert.equal(prefix + ' ' + forzaEarlySpeechRemainder(answer, prefix), answer);
});

test('reject an SSE final event that revised the already spoken prefix', () => {
  assert.throws(() => forzaEarlySpeechRemainder(
    'لطفاً ابعاد قطعه را بفرمایید. سپس بررسی می‌کنم.',
    'لطفاً کد فنی قطعه را بفرمایید.'
  ), /forza_early_tts_final_prefix_changed/);
});

test('old progressive SSE clause experiment remains unused for full-answer Pocket',async()=>{
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  assert.match(source,/await playPocketFullAnswer\(reply,continuousPlayer,pocketAbort.signal\)/);
  assert.doesNotMatch(source,/ForzaLiveSpeechQueue|earlyPlayback|earlyClause|VITE_FORZA_EARLY_TTS/);
  assert.match(source,/await consumeForzaTextStream/);
});
