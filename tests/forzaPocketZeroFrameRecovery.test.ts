import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const phrase=readFileSync(new URL('../src/utils/forzaStreamingSpeech.ts',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');

test('never hard-fail on zero-frame Pocket stream without trying same original voice',()=>{
  assert.match(ui,/allowFallback:true/);
  assert.match(ui,/stage=zero-frame-recover engine=pocket-farsi-v2/);
  assert.match(ui,/await requestPocketAudio\(phrase\)/);
  assert.match(ui,/wavRes=await fetch\(url\)/);
  assert.match(ui,/new Uint8Array\(await wavRes\.arrayBuffer\(\)\)/);
  assert.match(ui,/player\.enqueueWav\(wavBytes\)/);
  assert.match(ui,/X-Forza-Voice/);
  assert.match(ui,/pocket-farsi-v2/);
  assert.doesNotMatch(ui,/new SpeechSynthesisUtterance|speechSynthesis\.speak/);
  assert.match(backend,/internalForzaVoiceUrl\+'\/speak'/);
});

test('a partially streamed Pocket response cannot replay its already spoken words',()=>{
  assert.match(ui,/if\(receivedFrames>0 \|\| options\?\.signal\?\.aborted/);
  assert.match(ui,/reason==='forza_original_pocket_voice_required'/);
  assert.match(ui,/reason==='forza_stream_wrong_voice'/);
  assert.match(ui,/options\?\.onScheduled\?\.\(playback\)/);
  assert.match(ui,/void playback\.catch\(\(\)=>\{\}\)/);
});

test('fix 15-second AI text idle timeout without applying it to TTS synthesis',()=>{
  assert.match(ui,/ارتباط متن هوش مصنوعی بیش از ۴۵ ثانیه بدون داده ماند/);
  assert.match(ui,/دریافت متن پاسخ هوش مصنوعی بیش از دو دقیقه طول کشید/);
  assert.doesNotMatch(ui,/streamController\.abort\(new Error\('ارتباط هنگام دریافت پاسخ قطع شد\.'\)\),15000/);
  assert.match(ui,/AbortSignal\.timeout\(420000\)/);
});

test('shorter first phrase never replaces the original model or selected voice',()=>{
  assert.match(phrase,/const target=first\?48:130/);
  assert.match(phrase,/const max=first\?90:180/);
  assert.match(ui,/forza_original_pocket_voice_required/);
  assert.doesNotMatch(ui,/FORZA_ONNX_INT4|FORZA_ONNX_INT8/);
});
