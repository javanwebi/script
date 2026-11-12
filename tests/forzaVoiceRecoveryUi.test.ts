import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const audio=readFileSync(new URL('../src/utils/forzaContinuousWav.ts',import.meta.url),'utf8');
const avatar=readFileSync(new URL('../src/components/forza/ParticleAvatar.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/components/forza/style.css',import.meta.url),'utf8');
const routePreload=readFileSync(new URL('../src/components/layout/RouteIntentPreload.tsx',import.meta.url),'utf8');
const forzaPage=readFileSync(new URL('../src/pages/AiForzaPage.tsx',import.meta.url),'utf8');

test('new FORZA turns retain the mic instead of stopping live WebSpeech before AI playback',()=>{
  const from=ui.indexOf('const handleUserFinishedSpeaking = useCallback(');
  const to=ui.indexOf('// Setup MediaRecorder',from);
  assert.ok(from>0 && to>from);
  const turn=ui.slice(from,to);
  assert.doesNotMatch(turn,/\bstopListening\(\)/,'no dropped microphone frames at each request');
  assert.match(turn,/startListening\(true\)/,'monitor STT while model/TTS runs');
  assert.match(turn,/recognitionConsumedCountRef\.current=recognitionCheckpointRef\.current.count/);
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

test('particle identity loads after first paint and adapts density to the available GPU',()=>{
  assert.match(ui,/const \[quality, setQuality\] = useState<'balanced' \| 'low'>/);
  assert.match(ui,/slowFpsSamplesRef\.current >= 2/);
  assert.match(avatar,/await import\('\.\/pixels'\)/);
  assert.match(avatar,/buildLayers\(data, W, H, qualityMode\)/);
  assert.match(avatar,/quality === 'balanced' \? 2/);
  assert.match(avatar,/setClearColor\(0x080402, 0\)/);
  assert.match(avatar,/dt \/ 2\.8/);
  assert.match(ui,/PROCEDURAL IDENTITY/);
  assert.match(ui,/PARTICLE MESH · REALTIME GPU/);
  assert.match(ui,/SYNC <b className="text-white">—<\/b>/);
  assert.match(ui,/AI FORZA در حال صحبت/);
  assert.doesNotMatch(ui,/const \[quality\] = useState<'high'>/);
});

test('stop remains accessible but does not expand the original status pill',()=>{
  assert.match(ui,/<Square size=\{13\} fill="currentColor" \/>/);
  assert.match(ui,/aria-label="توقف پاسخ فورزا"/);
  assert.doesNotMatch(ui,/className="rounded-md border border-orange-400\/60 px-2 py-1/);
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
  assert.match(ui,/await playPocketFullAnswer\(phrase,player,controller\.signal,/);
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
  assert.match(vad,/lastMicActivityRef\.current=micNow/);
  assert.doesNotMatch(vad,/requestAnimationFrame|cancelAnimationFrame/);
  assert.match(ui,/autoGainControl:true/);
  assert.match(ui,/source=diba rejected=below_near_field_vad/);
  assert.match(ui,/source=browser rejected=below_near_field_vad/);
  assert.match(ui,/Date\.now\(\)-lastMicActivityRef\.current>3500/);
  assert.match(ui,/onPointerDownCapture=\{resumeAudioFromGesture\}/);
  assert.match(ui,/unlockForzaAudioFromGesture\(\)/);
  assert.match(ui,/ctxRef\.current\?\.state === 'running'/);
  assert.match(ui,/formation_watchdog_fallback=1/);
});

test('a pure stop consumes cumulative Chrome finals instead of replaying the same command',()=>{
  const start=ui.indexOf("if(q && forzaTurnIntent(q)==='stop')");
  const end=ui.indexOf('// Chrome keeps final results',start);
  assert.ok(start>=0 && end>start);
  const stop=ui.slice(start,end);
  assert.match(stop,/recognitionConsumedCountRef\.current=recognitionCheckpointRef\.current.count/);
  assert.match(stop,/localSttFinalRef\.current=''/);
  assert.match(stop,/return;/);
});


test('FORZA route paints its shell while the voice controller and particle scene load independently',()=>{
  assert.match(forzaPage,/lazy\(\(\) =>/);
  assert.match(forzaPage,/import\('\.\.\/components\/forza\/AiForzaCallExperience'\)/);
  assert.match(forzaPage,/<Suspense fallback=/);
  assert.match(routePreload,/import\('\.\.\/forza\/AiForzaCallExperience'\)/);
});

test('FORZA opens its voice controller without putting Three.js in the first call bundle',()=>{
  assert.match(ui,/const ParticleAvatar = lazy\(async \(\) =>/);
  assert.match(ui,/await import\('\.\/ParticleAvatar'\)/);
  assert.match(ui,/<Suspense fallback=\{<div className="forza-avatar-fallback"/);
  assert.match(routePreload,/import\('\.\.\/forza\/ParticleAvatar'\)/);
  assert.match(routePreload,/const warmForza=\(\)=>Promise\.all/);
});

test('mobile call uses one live message card and removes floating bottom action groups',()=>{
  assert.match(ui,/const showCustomerTranscript = Boolean\(userText\.trim\(\)\)/);
  assert.match(ui,/const showAssistantTranscript = !showCustomerTranscript && Boolean\(displayedAi\)/);
  assert.match(ui,/forza-message-card--customer/);
  assert.match(ui,/forza-message-card--assistant/);
  assert.doesNotMatch(ui,/QUICK_TOPICS|Restore button when HUD hidden/);
  assert.match(styles,/\.forza-status-dock/);
  assert.match(styles,/\.forza-message-card/);
  assert.match(styles,/bottom: calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
});

test('particle engine stops its render loop while the tab is hidden and resumes without a time jump',()=>{
  assert.match(avatar,/document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(avatar,/if \(document\.hidden\)/);
  assert.match(avatar,/last = performance\.now\(\)/);
  assert.match(avatar,/document\.removeEventListener\('visibilitychange', handleVisibilityChange\)/);
});


test('Diba recording keeps only a short idle pre-roll and retains audio after speech starts',()=>{
  assert.match(ui,/const maxChunks=hasSpeechSoundRef\.current\?180:8/);
  assert.match(ui,/hasSpeechSoundRef\.current = true/);
  assert.match(ui,/const audioBlob=chunks\.length\?new Blob\(chunks/);
});

test('server Diba STT verifies captured speech only when local Diba is ready and never falls back to Gemini',()=>{
  assert.match(ui,/const needsServerFinal = Boolean\(audioBlob\) && serverSttConfiguredRef\.current === true/);
  assert.match(ui,/transcribeOnly:true/);
  assert.match(ui,/fetch\('\/api\/ai\/forza-live'/);
  assert.match(ui,/info\.serverSttProvider==='diba'/);
  assert.match(ui,/info\.serverSttReady===true/);
  assert.match(ui,/دایبا تنظیم نشده؛ متن زنده مرورگر/);
  assert.match(ui,/serverSttConfiguredRef=useRef\(false\)/);
  assert.match(ui,/تشخیص گفتار: \{serverSttLabel\}/);
});
