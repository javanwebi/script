import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const worker=readFileSync(new URL('../scripts/forza_diba_stt_worker.py',import.meta.url),'utf8');
const docker=readFileSync(new URL('../Dockerfile',import.meta.url),'utf8');

test('production image bundles the offline Persian Diba recognizer and RAM-only decoder',()=>{
  assert.match(docker,/ffmpeg/);
  assert.match(docker,/vosk==0\.3\.45/);
  assert.match(docker,/Dibachain\/Diba-STT/);
  assert.match(docker,/FORZA_STT_PROVIDER=diba/);
  assert.match(worker,/subprocess\.run\(/);
  assert.match(worker,/input=raw/);
  assert.match(worker,/stdout=subprocess\.PIPE/);
  assert.doesNotMatch(worker,/write_bytes|writeFile|open\([^)]*audio/i);
});

test('server exposes Diba readiness and uses it for both standalone and live STT',()=>{
  assert.match(server,/serverSttProvider:choice\.provider/);
  assert.match(server,/serverSttReady:choice\.provider==='diba'\?isForzaDibaSttReady\(\)/);
  assert.match(server,/transcribeForzaDibaAudio\(cleanAudioData/);
  assert.match(server,/transcribeForzaDibaAudio\(audioBase64/);
  assert.match(server,/provider=diba transcript_chars=/);
});

test('final browser speech avoids duplicate STT while provisional or missing speech uses server Diba',()=>{
  assert.match(client,/pendingTranscriptRef\.current=candidate/);
  assert.match(client,/recorder\.stop\(\)/);
  assert.match(client,/handleUserFinishedSpeaking\(currentTranscript,audioBlob,finalMime\)/);
  assert.match(client,/chooseForzaFinalTranscript\(q,serverTranscript\)/);
  assert.match(client,/const needsServerFinal = !q \|\| speechInterimRef\.current/);
  assert.match(client,/if \(audioBlob && needsServerFinal\)/);
  assert.match(client,/source=browser-final server_verify=skipped/);
  assert.match(client,/browser_fallback=/);
});

test('first TTS turn waits for voice identity and carries a unique rate-limit turn id',()=>{
  assert.match(client,/await ensureVoiceMode\(\)/);
  assert.match(client,/call-'\+callIdRef\.current\+'-turn-'\+generation/);
  assert.match(client,/returnedVoice=response\.headers\.get\('X-Forza-Voice'\)/);
});

test('greeting recovers through the already-unlocked shared AudioContext when HTML audio is blocked',()=>{
  assert.match(client,/if \(audio\.src !== targetUrl \|\| audio\.error\)[\s\S]{0,180}audio\.load\(\)/);
  assert.match(client,/unlockedContext\?\.state === 'running'[\s\S]{0,450}playViaWebAudio\(\)/);
  assert.match(client,/autoplay_fallback=shared_webaudio/);
});

test('greeting prewarm shares one private voice and timeout never launches duplicate synthesis',()=>{
  assert.match(server,/const privateServiceGreeting=createForzaGreeting\(renderPocketSpeech,\[\]\)/);
  assert.match(server,/internalForzaVoiceUrl\?privateServiceGreeting\(\):getForzaGreeting\(\)/);
  assert.match(client,/finish\(new Error\('forza_audio_start_timeout'\)\)/);
  assert.doesNotMatch(client,/playback did not start before watchdog[\s\S]{0,180}failed\(\)/);
});

test('existing navigation gestures unlock the shared AudioContext before route transition',()=>{
  const unlock=readFileSync(new URL('../src/utils/forzaAudioUnlock.ts',import.meta.url),'utf8');
  const consult=readFileSync(new URL('../src/pages/AiConsultPage.tsx',import.meta.url),'utf8');
  const consumer=readFileSync(new URL('../src/pages/ConsumerDashboardPage.tsx',import.meta.url),'utf8');
  assert.match(unlock,/context\.resume\(\)/);
  assert.match(consult,/unlockForzaAudioFromGesture\(\);\s*navigate\('\/ai-forza'\)/);
  assert.match(consumer,/onClick=\{unlockForzaAudioFromGesture\}/);
});
