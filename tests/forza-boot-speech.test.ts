import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldRemountAfterCatalogHydration, shouldRequestFullCatalogOnBoot, isForzaCallPath} from '../src/utils/forzaBootPolicy';

const frontend=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
const pocketWorker=readFileSync(new URL('../scripts/forza_pocket_worker.py',import.meta.url),'utf8');
const pocketHttp=readFileSync(new URL('../scripts/forza_voice_http.py',import.meta.url),'utf8');

test('FORZA voice and its alias use lean runtime and never remount during hydration',()=>{
  const callRoutes=['/ai-forza','/ai-forza/','/ai-forza/session','/face-to-face','/face-to-face/'];
  for(const path of callRoutes){
    assert.equal(isForzaCallPath(path),true,path);
    assert.equal(shouldRemountAfterCatalogHydration(path),false,path);
    assert.equal(shouldRequestFullCatalogOnBoot(path),false,path);
  }
  for(const path of ['/','/products','/categories','/category/bearings','/search']){
    assert.equal(shouldRequestFullCatalogOnBoot(path),true,path);
    assert.equal(shouldRemountAfterCatalogHydration(path),true,path);
  }
  assert.equal(shouldRequestFullCatalogOnBoot('/admin'),false);
  assert.equal(shouldRequestFullCatalogOnBoot('/admin/catalog'),false);
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  assert.match(main,/includeProducts:shouldRequestFullCatalogOnBoot\(window\.location\.pathname\)/);
  const portal=readFileSync(new URL('../src/services/portalRepository.ts',import.meta.url),'utf8');
  assert.match(portal,/includeProducts=shouldRequestFullCatalogOnBoot\(pathname\)/);
});

test('FORZA renders live SSE words and sends complete Nima word groups to the existing private voice',()=>{
  assert.match(frontend,/await consumeForzaTextStream/);
  assert.match(frontend,/reply=callPlainText\.push\(fullText\)/);
  assert.match(frontend,/setAiText\(reply\)/);
  assert.match(frontend,/new ForzaIncrementalSpeechText\(\)/);
  assert.match(frontend,/new ForzaNimaBufferedSpeech\(/);
  assert.match(frontend,/activeNimaBuffer\.add\(phrase\)/);
  assert.match(frontend,/flushTerminalIdle/);
  assert.match(frontend,/new ForzaContinuousWav\(/);
  assert.match(frontend,/await requestPocketAudio\(/);
  assert.match(frontend,/await player\.enqueueWav\(audio\)/);
  assert.match(frontend,/phase=phrase_wav_ready/);
  assert.match(frontend,/piper-nima-gyro-medium/);
  assert.match(frontend,/playPocketFullAnswer/);
  assert.match(backend,/app\.post\('\/api\/ai\/forza-speech'/);
  assert.match(backend,/internalForzaVoiceUrl\+'\/speak'/);
  assert.match(backend,/forzaUnbrokenSpokenText\(phrase\)/);
  assert.match(pocketHttp,/MAX_TEXT_CHARS = 1000/);
  assert.match(pocketHttp,/self\.reply\(200, audio, "audio\/wav"\)/);
  assert.doesNotMatch(frontend,/ForzaLiveSpeechQueue|liveSpeech\?\.receive|playPocketProgressive|readForzaWavFrames/);
  assert.doesNotMatch(frontend,/speechSynthesis\.speak|new SpeechSynthesisUtterance/);
});

test('Nima is incremental while Pocket remains a safe one-WAV fallback; audio stays in memory',()=>{
  assert.match(frontend,/voiceModeRef\.current==='piper-nima-gyro-medium'/);
  assert.match(frontend,/voiceModeRef\.current==='piper-nima-gyro-medium'\s*\? AbortSignal\.timeout\(35000\) : AbortSignal\.timeout\(420000\)/);
  assert.match(frontend,/AbortSignal\.any\(\[signal,timeoutSignal\]\)/);
  assert.match(frontend,/pocketAbort\.abort\(\)/);
  assert.match(frontend,/await response\.arrayBuffer\(\)/);
  assert.match(frontend,/player\.enqueueWav\(audio\)/);
  assert.match(frontend,/await playPocketFullAnswer\(/);
  assert.doesNotMatch(frontend,/voiceCacheRef|voiceRequestsRef|lastPlayableVoiceRef/);
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

test('original prerecorded welcome remains available and is not generated twice',()=>{
  assert.match(frontend,/\/forza-greeting-bootstrap\.wav/);
  assert.match(frontend,/greetingStartedRef\.current/);
  assert.match(frontend,/startWatchdog = window\.setTimeout\(/);
  assert.doesNotMatch(frontend,/pocket-tts-farsi-v2-onnx/);
});

test('Express forwards Pocket and Nima requests to the authenticated private Ubuntu voice',()=>{
  assert.match(backend,/FORZA_VOICE_INTERNAL_URL/);
  assert.match(backend,/X-Forza-Voice-Token/);
  assert.match(backend,/private_voice_not_configured/);
  assert.match(backend,/private_voice_token_missing/);
  assert.match(backend,/voice_busy/);
  assert.doesNotMatch(backend,/synthesizeServerPocket\(/);
  assert.doesNotMatch(backend,/warmServerPocket\(/);
});
