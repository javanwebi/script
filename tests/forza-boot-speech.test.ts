import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldRemountAfterCatalogHydration} from '../src/utils/forzaBootPolicy';

const frontend=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
const pocketWorker=readFileSync(new URL('../scripts/forza_pocket_worker.py',import.meta.url),'utf8');
const pocketHttp=readFileSync(new URL('../scripts/forza_voice_http.py',import.meta.url),'utf8');

test('FORZA active session does not remount during catalog hydration',()=>{
  for(const path of ['/ai-forza','/ai-forza/','/ai-forza/session'])
    assert.equal(shouldRemountAfterCatalogHydration(path),false);
  assert.equal(shouldRemountAfterCatalogHydration('/'),true);
});
test('FORZA speaks one complete AI reply as a single Pocket WAV, never phrase chunks',()=>{
  assert.match(frontend,/const onTextChunk=.*?=>\{/s);
  assert.match(frontend,/setAiText\(fullText\)/);
  assert.match(frontend,/const audioUrl=await requestPocketAudio\(reply\.trim\(\)\)/);
  assert.match(frontend,/await continuousPlayer\.enqueue\(audioUrl\)/);
  assert.match(frontend,/await playSpeechPhrase\(text\.trim\(\)\)/);
  assert.match(frontend,/AbortSignal\.timeout\(420000\)/);
  assert.doesNotMatch(frontend,/takeSpeakablePhrase|streamPocketPhrase|readForzaWavFrames|queuePhrase\(/);
  assert.doesNotMatch(frontend,/fetch\s*\(\s*['"]\/api\/ai\/forza-speech-stream/);
  assert.match(backend,/app\.post\('\/api\/ai\/forza-speech'/);
  assert.match(backend,/phrase\.length>1000/);
  assert.match(backend,/AbortSignal\.timeout\(420000\)/);
  assert.match(backend,/\/speak/);
  assert.match(backend,/X-Forza-Voice-Token/);
  assert.match(frontend,/X-Forza-Voice/);
  assert.match(frontend,/new ForzaContinuousWav/);
  assert.match(pocketHttp,/MAX_TEXT_CHARS = 1000/);
  assert.match(pocketHttp,/MAX_REQUEST_BYTES = 8192/);
  assert.match(pocketHttp,/audio = render\(engine, phrase\)/);
  assert.match(pocketWorker,/mode="pack"/);
  assert.doesNotMatch(frontend,/در حال تبدیل صدای شما به متن و ارسال به سرور/);
  assert.doesNotMatch(frontend,/speechSynthesis\.speak|synth\.speak|new SpeechSynthesisUtterance/);
  assert.doesNotMatch(frontend,/waitForLocalPersianSpeechVoice/);
});
test('existing prerecorded greeting is preserved and there is no client TTS model download',()=>{
  assert.match(frontend,/\/forza-greeting-bootstrap\.wav/);
  assert.doesNotMatch(frontend,/pocket-tts-farsi-v2-onnx/);
});
test('Express forwards Pocket requests via authenticated private network and never runs in-process inference',()=>{
  assert.match(backend,/FORZA_VOICE_INTERNAL_URL/);
  assert.match(backend,/X-Forza-Voice-Token/);
  assert.match(backend,/private_voice_not_configured/);
  assert.match(backend,/private_voice_token_missing/);
  assert.match(backend,/voice_busy/);
  assert.doesNotMatch(backend,/synthesizeServerPocket\(/);
  assert.doesNotMatch(backend,/warmServerPocket\(/);
});
