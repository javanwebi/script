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
test('FORZA submits one complete AI answer then plays ready Pocket frames immediately',()=>{
  assert.match(frontend,/await consumeForzaTextStream/);
  assert.match(frontend,/setAiText\(fullText\)/);
  assert.match(frontend,/const response=await fetch\('\/api\/ai\/forza-speech-stream'/);
  assert.match(frontend,/body:JSON\.stringify\(\{text:phrase\}\)/);
  assert.match(frontend,/await readForzaWavFrames\(response,frame=>\{/);
  assert.match(frontend,/player\.enqueueWav\(frame\)/);
  assert.match(frontend,/await playPocketProgressive\(reply\.trim\(\),continuousPlayer\)/);
  assert.match(frontend,/new ForzaContinuousWav/);
  assert.doesNotMatch(frontend,/takeSpeakablePhrase|streamPocketPhrase|queuePhrase\(/);
  assert.match(backend,/app\.post\('\/api\/ai\/forza-speech-stream'/);
  assert.match(backend,/phrase\.length>1000/);
  assert.match(backend,/internalForzaVoiceUrl\+'\/speak-stream'/);
  assert.match(backend,/X-Accel-Buffering','no'/);
  assert.match(pocketHttp,/MAX_TEXT_CHARS = 1000/);
  assert.match(pocketHttp,/frames = render_chunks\(engine, phrase\)/);
  assert.match(pocketWorker,/def render_chunks\(engine, text\):/);
  assert.doesNotMatch(frontend,/در حال تبدیل صدای شما به متن و ارسال به سرور/);
  assert.doesNotMatch(frontend,/speechSynthesis\.speak|synth\.speak|new SpeechSynthesisUtterance/);
});

test('customer WAV bytes stay transient and fallback never replays partially spoken replies',()=>{
  assert.doesNotMatch(frontend,/voiceCacheRef|voiceRequestsRef|lastPlayableVoiceRef/);
  assert.match(frontend,/if\(receivedFrames>0\)throw error/);
  assert.match(frontend,/await requestPocketAudio\(phrase\)/);
  assert.match(frontend,/URL\.revokeObjectURL\(url\)/);
  assert.match(frontend,/await Promise\.all\(scheduled\)/);
  assert.doesNotMatch(pocketHttp,/audio_cache|MAX_CACHED_RESPONSES|OrderedDict/);
  assert.match(pocketHttp,/self\.reply\(200, audio, "audio\/wav"\)/);
  assert.match(backend,/Cache-Control','no-store'/);
  assert.match(pocketWorker,/len\(jobs\) > 256/);
  assert.match(pocketWorker,/pool\.submit\(generate, next_job\)/);
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
