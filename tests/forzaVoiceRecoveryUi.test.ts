import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const audio=readFileSync(new URL('../src/utils/forzaContinuousWav.ts',import.meta.url),'utf8');
const avatar=readFileSync(new URL('../src/components/forza/ParticleAvatar.tsx',import.meta.url),'utf8');

test('new FORZA turns retain the mic instead of stopping live WebSpeech before AI playback',()=>{
  const from=ui.indexOf('const handleUserFinishedSpeaking = useCallback(');
  const to=ui.indexOf('// Setup MediaRecorder',from);
  assert.ok(from>0 && to>from);
  const turn=ui.slice(from,to);
  assert.doesNotMatch(turn,/\bstopListening\(\)/,'no dropped microphone frames at each request');
  assert.match(turn,/startListening\(true\)/,'monitor STT while model/TTS runs');
  assert.match(turn,/recognitionConsumedCountRef\.current=recognitionResultCountRef\.current/);
  assert.match(turn,/activeTurnRef\.current\?\.generation!==generation/);
  assert.match(turn,/activeNimaBuffer\.finish\(\)/);
  assert.match(turn,/bounded_idle_flush=1/);
});

test('text correction can stop a pending/playing answer and does not block on UI thinking state',()=>{
  assert.match(ui,/interruptCurrentTurn\(\);/);
  assert.match(ui,/const submitUserText = \(text: string\)/);
  assert.match(ui,/onClick=\{interruptCurrentTurn\}/);
  assert.match(ui,/توقف پاسخ فورزا/);
  assert.match(ui,/const \[voiceStage,setVoiceStage\]/);
  assert.match(ui,/voiceStage === 'buffering'/);
  assert.match(ui,/voiceStage === 'playing'/);
});

test('no fake 60fps, sync health or high-density mobile avatar fallback',()=>{
  assert.match(ui,/navigator\.hardwareConcurrency/);
  assert.match(ui,/setQuality\(prev=>prev==='high'\?'balanced':'low'\)/);
  assert.match(avatar,/stride>1 && Math\.random\(\)>=1\/stride/);
  assert.match(avatar,/quality==='low'\?4/);
  assert.doesNotMatch(ui,/99\.4%|200K\+ PARTICLES|:'60 FPS'/);
});

test('AudioContext remains measurable and fails closed instead of silently showing playing forever',()=>{
  assert.match(audio,/forza_audio_context_suspended/);
  assert.match(audio,/this\.contextMonitors\.add\(contextMonitor\)/);
  assert.match(audio,/this\.onIdle\?\.\(\)/);
  assert.match(audio,/phase:'started'/);
  assert.match(audio,/phase:'interrupted'/);
});

test('manual replay keeps microphone monitoring alive and aborts in-flight TTS on user interruption',()=>{
  assert.match(ui,/const manualReplayAbortRef=useRef<AbortController\|null>\(null\)/);
  assert.match(ui,/manualReplayAbortRef\.current\?\.abort\(new Error\('forza_manual_replay_stopped'\)\)/);
  assert.match(ui,/isManualReplayPendingRef\.current=true;\s*startListening\(true\)/);
  assert.match(ui,/await playPocketFullAnswer\(phrase,player,controller\.signal\)/);
  assert.match(ui,/if\(isProcessingTurnRef\.current\|\|isAiSpeakingRef\.current\|\|isManualReplayPendingRef\.current\)/);
  assert.match(ui,/if\(!\/aborted\|stopped\|interrupted\|cancelled\/i\.test\(code\)\)/);
});

test('mic VAD is independent of WebGL animation frame rate',()=>{
  const beginning=ui.indexOf('// Low-latency VAD uses actual mic PCM RMS');
  const end=ui.indexOf('// Compute reactive mode for Three.js ParticleAvatar',beginning);
  assert.ok(beginning>0&&end>beginning);
  const vad=ui.slice(beginning,end);
  assert.match(vad,/window\.setInterval\(check,55\)/);
  assert.match(vad,/window\.clearInterval\(micPoll\)/);
  assert.doesNotMatch(vad,/requestAnimationFrame|cancelAnimationFrame/);
});

test('a pure stop consumes cumulative Chrome finals instead of replaying the same command',()=>{
  const start=ui.indexOf("if(q && forzaTurnIntent(q)==='stop')");
  const end=ui.indexOf('// Chrome keeps final results',start);
  assert.ok(start>=0 && end>start);
  const stop=ui.slice(start,end);
  assert.match(stop,/recognitionConsumedCountRef\.current=recognitionResultCountRef\.current/);
  assert.match(stop,/localSttFinalRef\.current=''/);
  assert.match(stop,/return;/);
});
