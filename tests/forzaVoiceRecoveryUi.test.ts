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

test('restored original full-density particle identity and classic FORZA HUD',()=>{
  assert.match(ui,/const \[quality\] = useState<'high'>\('high'\)/);
  assert.match(avatar,/const layers = buildLayers\(decode\(B64\)\)/);
  assert.match(avatar,/tier: 'ULTRA'/);
  assert.doesNotMatch(avatar,/stride>1|const thinning=|Math\.random\(\)>=1\/stride/);
  assert.doesNotMatch(ui,/setQuality\(|poorFpsSamplesRef/);
  assert.match(ui,/PROCEDURAL IDENTITY/);
  assert.match(ui,/PARTICLE MESH · REALTIME GPU/);
  assert.match(ui,/SYNC <b className="text-white">—<\/b>/);
  assert.match(ui,/AI FORZA در حال صحبت/);
  assert.doesNotMatch(ui,/99\.4%|200K\+ PARTICLES|:'60 FPS'/);
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

test('SSE model/provider failure cannot trigger another long complete-text request',()=>{
  assert.match(ui,/let allowLegacyFallback=false/);
  assert.match(ui,/allowLegacyFallback=streamRes\.status===404\|\|streamRes\.status===405/);
  assert.match(ui,/if\(!allowLegacyFallback\)\{/);
  assert.match(ui,/phase=failed_no_chained_model_retry/);
});

test('new private Nima phrase metadata reaches Node and returns measurable ordering wait',()=>{
  assert.match(ui,/phraseIndex\?:number/);
  assert.match(ui,/body:JSON\.stringify\(\{text,turnId,\.\.\.\(phraseIndex!==undefined/);
  assert.match(ui,/X-Forza-Order-Wait-Ms/);
  assert.match(ui,/synthesize:\(phrase,signal,index\)=>requestPocketAudio/);
});

test('no unplayed phrase text appears in interrupted conversation memory',()=>{
  assert.doesNotMatch(ui,/عبارت «'\+partial\.text/);
  assert.match(ui,/واژه‌های شنیده‌شده نامعلوم‌اند/);
  assert.match(ui,/phase=latency_missing reason=/);
  assert.match(ui,/missing=1 reason=no_acoustic_end_estimate/);
  assert.match(ui,/elapsedMonotonic=1/);
});

test('Worker fallback metadata is not falsely labelled working realtime STT',()=>{
  const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
  assert.match(backend,/serverStreamingStt:false/);
  assert.match(backend,/workerSttCandidate:Boolean\(configuredForzaWorkerUrl\(\)\)/);
  assert.match(ui,/info\.workerSttCandidate===true/);
  assert.match(ui,/serverSttConfiguredRef\.current=info\.serverSttConfigured\|\|/);
});

test('real errors persist in compact status while the next customer turn can retry',()=>{
  assert.match(ui,/setVoiceStage\('error'\)/);
  assert.match(ui,/setVoiceStage\(previous=>previous==='error'\?'error':'idle'\)/);
  assert.match(ui,/voiceStage === 'error'/);
  assert.match(ui,/خطا در پاسخ؛ می‌توانید دوباره صحبت کنید/);
  assert.match(ui,/setVoiceStage\('text'\)/);
});

test('each listening period starts a fresh acoustic clock and muted audio is excluded from P95',()=>{
  assert.match(ui,/detectedSpeechEndAtRef\.current=0;\s+sttFinalAtRef\.current=0/);
  assert.match(ui,/missing=1 reason=speaker_muted/);
  assert.match(ui,/stage==='playback_started'&&!speakerMutedRef\.current/);
});

test('raw LLM and private TTS exception bodies cannot reach diagnostic console output',()=>{
  assert.match(ui,/turn_unexpected_error/);
  assert.match(ui,/tts_unexpected_error/);
  assert.doesNotMatch(ui,/Conversational turn failed:', err\?\.message/);
  assert.doesNotMatch(ui,/stage=turn-failed code='\+\s+String\(error\?\.message/);
});

test('one opaque turn key joins browser SSE, speech synthesis and interruption traces',()=>{
  assert.match(ui,/const turnKey='call-'\+callIdRef\.current\+'-turn-'\+generation/);
  assert.match(ui,/userTurnId:turnKey/);
  assert.match(ui,/turnKey,index\)/);
  assert.match(ui,/phase=customer-interrupt turn='\+'call-'\+callIdRef\.current/);
  assert.match(ui,/phase=phrase_wav_ready index=/);
});

test('Gemini and Worker speech fallback cancel upstream work on browser close',()=>{
  const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
  assert.match(backend,/sttResult=await withForzaSttDeadline\(signal=>/);
  assert.match(backend,/config:\{abortSignal:signal\}/);
  assert.match(backend,/req\.once\('aborted',onSttDisconnect\)/);
  assert.match(backend,/req\.once\('aborted',onWorkerSttDisconnect\)/);
  assert.match(backend,/res\.once\('close',onWorkerSttDisconnect\)/);
  assert.match(backend,/if\(req\.aborted\|\|res\.destroyed\)return/);
});

