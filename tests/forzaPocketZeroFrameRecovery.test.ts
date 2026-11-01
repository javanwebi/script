import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
const whole=readFileSync(new URL('../src/utils/forzaWholeAnswerSpeech.ts',import.meta.url),'utf8');

test('full-answer Pocket needs no stream fallback or zero-frame retry',()=>{
  assert.doesNotMatch(ui,/allowFallback:true|zero-frame-recover|ForzaLiveSpeechQueue/);
  assert.match(ui,/const response=await fetch\('\/api\/ai\/forza-speech'/);
  assert.match(ui,/await playPocketFullAnswer\(reply,continuousPlayer,pocketAbort.signal\)/);
  assert.match(whole,/await player\.enqueueWav\(wav\)/);
  assert.match(ui,/X-Forza-Voice/);
  assert.match(ui,/pocket-farsi-v2/);
  assert.match(backend,/internalForzaVoiceUrl\+'\/speak'/);
  assert.doesNotMatch(ui,/new SpeechSynthesisUtterance|speechSynthesis\.speak/);
});

test('one complete answer only is spoken; no partial packet can be replayed',()=>{
  assert.match(ui,/await consumeForzaTextStream/);
  assert.match(ui,/if \(reply\) \{/);
  assert.match(ui,/Text stream incomplete; refusing partial speech/);
  assert.doesNotMatch(ui,/readForzaWavFrames|scheduledPlaybacks|onScheduled/);
});

test('15-second text idle deadline was fixed separately from full WAV TTS',()=>{
  assert.match(ui,/ارتباط متن هوش مصنوعی بیش از ۴۵ ثانیه بدون داده ماند/);
  assert.match(ui,/دریافت متن پاسخ هوش مصنوعی بیش از دو دقیقه طول کشید/);
  assert.match(ui,/AbortSignal\.timeout\(420000\)/);
});

test('unbroken full-answer TTS preserves original voice and avoids quantization',()=>{
  assert.match(ui,/forza_original_pocket_voice_required/);
  assert.match(backend,/forzaUnbrokenSpokenText\(phrase\)/);
  assert.doesNotMatch(ui,/FORZA_ONNX_INT4|FORZA_ONNX_INT8/);
});
