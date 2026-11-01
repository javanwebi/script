import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldRemountAfterCatalogHydration} from '../src/utils/forzaBootPolicy';

const frontend=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
const pocketWorker=readFileSync(new URL('../scripts/forza_pocket_worker.py',import.meta.url),'utf8');
const pocketHttp=readFileSync(new URL('../scripts/forza_voice_http.py',import.meta.url),'utf8');
const wholeAnswer=readFileSync(new URL('../src/utils/forzaWholeAnswerSpeech.ts',import.meta.url),'utf8');

test('FORZA active session does not remount during catalog hydration',()=>{
  for(const path of ['/ai-forza','/ai-forza/','/ai-forza/session'])
    assert.equal(shouldRemountAfterCatalogHydration(path),false);
  assert.equal(shouldRemountAfterCatalogHydration('/'),true);
});
test('FORZA renders live words but requests only one original Pocket WAV per complete reply',()=>{
  assert.match(frontend,/await consumeForzaTextStream/);
  assert.match(frontend,/setAiText\(fullText\)/);
  assert.match(frontend,/await playPocketFullAnswer\(reply,continuousPlayer,pocketAbort.signal\)/);
  assert.match(frontend,/const response=await fetch\('\/api\/ai\/forza-speech'/);
  assert.match(frontend,/body:JSON\.stringify\(\{text\}\)/);
  assert.match(frontend,/new Uint8Array\(await response\.arrayBuffer\(\)\)/);
  assert.match(frontend,/await playForzaWholeAnswer\(answer,requestPocketAudio,player,signal\)/);
  assert.match(wholeAnswer,/await player\.enqueueWav\(wav\)/);
  assert.match(frontend,/phase=whole-pocket-wav-ready/);
  assert.match(frontend,/new ForzaContinuousWav/);
  assert.doesNotMatch(frontend,/ForzaLiveSpeechQueue|liveSpeech\?\.receive|playPocketProgressive|readForzaWavFrames/);
  assert.match(backend,/app\.post\('\/api\/ai\/forza-speech'/);
  assert.match(backend,/internalForzaVoiceUrl\+'\/speak'/);
  assert.match(backend,/forzaUnbrokenSpokenText\(phrase\)/);
  assert.match(pocketHttp,/MAX_TEXT_CHARS = 1000/);
  assert.match(pocketHttp,/self\.reply\(200, audio, "audio\/wav"\)/);
  assert.doesNotMatch(frontend,/speechSynthesis\.speak|synth\.speak|new SpeechSynthesisUtterance/);
});

test('one full WAV is kept in memory and never cached or written to disk',()=>{
  assert.doesNotMatch(frontend,/voiceCacheRef|voiceRequestsRef|lastPlayableVoiceRef/);
  assert.match(frontend,/await response\.arrayBuffer\(\)/);
  assert.match(wholeAnswer,/player\.enqueueWav\(wav\)/);
  assert.match(frontend,/AbortSignal\.timeout\(420000\)/);
  assert.match(frontend,/pocketAbort\.abort\(\)/);
  assert.doesNotMatch(frontend,/URL\.createObjectURL\(blob\)|URL\.revokeObjectURL\(url\)/);
  assert.doesNotMatch(pocketHttp,/audio_cache|MAX_CACHED_RESPONSES|OrderedDict/);
  assert.match(backend,/Cache-Control','no-store'/);
  assert.match(pocketWorker,/def render\(engine, text\):/);
});

test('CPU 1 or 2 intra-op threads are opt-in, with FP32 as safe default',()=>{
  assert.match(pocketWorker,/CPU_INTRA = int\(os\.environ\.get\("FORZA_CPU_INTRA", "1"\)\)/);
  assert.match(pocketWorker,/FORZA_ONNX_INT8/);
  assert.match(pocketWorker,/flow_lm_step\.int8\.onnx/);
  const dockerfile=readFileSync(new URL('../Dockerfile.forza-voice',import.meta.url),'utf8');
  assert.match(dockerfile,/FORZA_CPU_INTRA/);
  assert.match(dockerfile,/FORZA_ONNX_INT8/);
  assert.match(dockerfile,/flow_lm_step\.int8\.onnx/);
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
