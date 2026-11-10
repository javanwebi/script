import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');

test('selected Nima uses incremental phrases; Pocket compatibility fallback remains one complete WAV',()=>{
  assert.doesNotMatch(ui,/allowFallback:true|zero-frame-recover|ForzaLiveSpeechQueue/);
  assert.match(ui,/const response=await fetch\('\/api\/ai\/forza-speech'/);
  assert.match(ui,/await activeNimaBuffer\.finish\(\)/);
  assert.match(ui,/if\(useNima\)/);
  assert.match(ui,/playPocketFullAnswer\(forzaSpokenPlainText\(reply\),continuousPlayer,pocketAbort\.signal,/);
  assert.match(ui,/await player\.enqueueWav\(audio\)/);
  assert.match(ui,/X-Forza-Voice/);
  assert.match(ui,/pocket-farsi-v2/);
  assert.match(backend,/internalForzaVoiceUrl\+'\/speak'/);
  assert.doesNotMatch(ui,/new SpeechSynthesisUtterance|speechSynthesis\.speak/);
});

test('one complete answer only is spoken; no partial packet can be replayed',()=>{
  assert.match(ui,/await consumeForzaTextStream/);
  assert.match(ui,/if \(reply\) \{/);
  assert.match(ui,/Text stream incomplete; refusing unverified trailing speech/);
  assert.doesNotMatch(ui,/readForzaWavFrames|scheduledPlaybacks|onScheduled/);
});

test('text idle deadline and complete WAV TTS timeout remain bounded',()=>{
  assert.match(ui,/ارتباط متن هوش مصنوعی بیش از ۴۵ ثانیه بدون داده ماند/);
  assert.match(ui,/دریافت متن پاسخ هوش مصنوعی بیش از دو دقیقه طول کشید/);
  assert.match(ui,/AbortSignal\.timeout\(420000\)/);
});

test('private voice identity is checked and unrecognized engines fail closed',()=>{
  assert.match(ui,/const returnedVoice=response\.headers\.get\('X-Forza-Voice'\)/);
  assert.match(ui,/returnedVoice==='piper-nima-gyro-medium'/);
  assert.match(ui,/forza_unknown_voice_identity/);
  assert.match(backend,/forzaUnbrokenSpokenText\(phrase\)/);
  assert.doesNotMatch(ui,/FORZA_ONNX_INT4|FORZA_ONNX_INT8/);
});
