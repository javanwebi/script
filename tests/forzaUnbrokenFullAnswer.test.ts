import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { forzaUnbrokenSpokenText } from '../src/utils/forzaUnbrokenText.ts';

test('entire Persian reply keeps every ordered word but removes pause punctuation',()=>{
  const original='لطفاً کد قطعه را بفرمایید. سپس موجودی را بررسی می‌کنم، و پیشنهاد می‌دهم. نتیجه چیست؟';
  const spoken=forzaUnbrokenSpokenText(original);
  assert.equal(spoken,'لطفاً کد قطعه را بفرمایید سپس موجودی را بررسی می‌کنم و پیشنهاد می‌دهم نتیجه چیست');
  assert.equal(spoken.split(' ').length,original.replace(/[.،؟]/g,' ').trim().split(/\s+/).length);
});

test('engineering numbers, decimals, belt SKU identifiers and slashes are preserved',()=>{
  const original='تسمه SPA-1250 با عرض 12.7 mm و گام 2.5، سفارش 12,7 میلی‌متر. 6202ZZ موجود است.';
  const spoken=forzaUnbrokenSpokenText(original);
  assert.equal(spoken,'تسمه SPA-1250 با عرض 12.7 mm و گام 2.5 سفارش 12,7 میلی‌متر 6202ZZ موجود است');
  assert.ok(spoken.includes('SPA-1250'));
  assert.ok(spoken.includes('12.7'));
  assert.ok(spoken.includes('12,7'));
  assert.ok(spoken.includes('2.5'));
  assert.ok(spoken.includes('6202ZZ'));
});

test('normalization never truncates the complete reply',()=>{
  const original='الف. ب، پ؟ ت! ث؛ ج: چ... ح';
  assert.equal(forzaUnbrokenSpokenText(original),'الف ب پ ت ث ج چ ح');
  assert.equal(forzaUnbrokenSpokenText('  '),'');
});

test('full answer is sent once after final SSE; no progressive phrase queue remains',()=>{
  const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../scripts/forza_pocket_worker.py',import.meta.url),'utf8');
  const player=readFileSync(new URL('../src/utils/forzaWholeAnswerSpeech.ts',import.meta.url),'utf8');
  assert.match(ui,/reply=await consumeForzaTextStream/);
  assert.match(ui,/await playPocketFullAnswer\(reply,continuousPlayer,pocketAbort\.signal\)/);
  assert.match(ui,/const response=await fetch\('\/api\/ai\/forza-speech'/);
  assert.match(ui,/await playForzaWholeAnswer\(answer,requestPocketAudio,player,signal\)/);
  assert.match(player,/await player\.enqueueWav\(wav\)/);
  assert.doesNotMatch(ui,/ForzaLiveSpeechQueue|liveSpeech\?\.receive|playPocketProgressive|readForzaWavFrames/);
  assert.match(ui,/forza_original_pocket_voice_required/);
  assert.match(server,/const spoken=forzaUnbrokenSpokenText\(phrase\)/);
  assert.match(server,/body:JSON\.stringify\(\{text:spoken\}\)/);
  assert.match(worker,/def _stitch\(self, segments\):/);
  assert.match(worker,/segments = \[\(audio, 0\.0\) for audio, _gap in segments\]/);
});
