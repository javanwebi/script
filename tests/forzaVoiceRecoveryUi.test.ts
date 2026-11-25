import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const audio=readFileSync(new URL('../src/utils/forzaContinuousWav.ts',import.meta.url),'utf8');
const speechPipeline=readFileSync(new URL('../src/utils/forzaSpeechPipeline.ts',import.meta.url),'utf8');
const consult=readFileSync(new URL('../server/ai/baiConsult.ts',import.meta.url),'utf8');
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
  assert.match(ui,/autoGainControl:false/);
  assert.match(ui,/speechAdmissionRef\.current\.decide/);
  assert.match(ui,/admission\.filter/);
  assert.doesNotMatch(ui,/Date\.now\(\)-lastMicActivityRef\.current>3500/);
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
  assert.match(ui,/const showAssistantTranscript = Boolean\(displayedAi\)/);
  assert.match(ui,/showCustomerTranscript && showAssistantTranscript/);
  assert.match(ui,/شما · متن کامل مکالمه/);
  assert.match(ui,/forza-message-card--customer/);
  assert.match(ui,/forza-message-card--assistant/);
  assert.doesNotMatch(ui,/QUICK_TOPICS|Restore button when HUD hidden/);
  assert.match(styles,/\.forza-status-dock/);
  assert.match(styles,/\.forza-message-card/);
  assert.match(styles,/max-height: min\(26vh, 320px\)/);
  assert.match(ui,/card\.scrollTop=card\.scrollHeight/);
  assert.match(styles,/bottom: calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
});

test('particle engine stops its render loop while the tab is hidden and resumes without a time jump',()=>{
  assert.match(avatar,/document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(avatar,/if \(document\.hidden\)/);
  assert.match(avatar,/last = performance\.now\(\)/);
  assert.match(avatar,/document\.removeEventListener\('visibilitychange', handleVisibilityChange\)/);
});


test('server AvalAI/Diba STT is recovery-only and never delays any usable live transcript',()=>{
  assert.match(ui,/const needsServerFinal = Boolean\(audioBlob\) &&\s+serverSttConfiguredRef\.current === true &&\s+!q/);
  assert.match(ui,/if\(audioBlob && needsServerFinal\)/);
  assert.match(ui,/source=live_transcript server_verifier=skipped/);
  assert.match(ui,/transcribeOnly:true/);
  assert.match(ui,/fetch\('\/api\/ai\/forza-live'/);
  assert.match(ui,/provider==='avalai'\|\|provider==='diba'\|\|provider==='gemini'/);
  assert.match(ui,/info\.serverSttReady===true/);
  assert.match(ui,/تشخیص گفتار سرور تنظیم نشده؛ متن زنده مرورگر/);
  assert.match(ui,/serverSttConfiguredRef=useRef\(false\)/);
  assert.match(ui,/تشخیص گفتار: \{serverSttLabel\}/);
});

test('native browser transcripts use a microphone-sensitive near-field gate while TTS barge-in stays strict',()=>{
  const from=ui.indexOf('rec.onresult = (event: any) => {');
  const to=ui.indexOf('if(admitted.waiting&&!retryExpired)',from);
  assert.ok(from>0&&to>from);
  const admission=ui.slice(from,to);
  assert.match(admission,/if\(retryExpired\|\|likelySpeakerEcho\(words\)\)return 'reject';/);
  assert.match(admission,/speechAdmissionRef\.current\.decide\(words,final,playback,Date\.now\(\)\)/);
  assert.doesNotMatch(admission,/if\(!playback\)return 'accept';/);
  const gate=readFileSync(new URL('../src/utils/forzaSpeechAdmission.ts',import.meta.url),'utf8');
  assert.match(gate,/playback\?0\.004:0\.0015/);
  assert.match(gate,/playback&&intent!=='stop'\?280:160/);
});

test('a two-second pause preserves the same live transcript across browser recognizer restarts',()=>{
  assert.match(ui,/recognitionSessionBaseRef=useRef<string>\(''\)/);
  assert.match(ui,/recognitionSessionBaseRef\.current=activeTranscriptRef\.current\.trim\(\)/);
  assert.match(ui,/appendForzaSpeechSegment\(recognitionSessionBaseRef\.current,currentSpeech\)/);
  assert.match(ui,/: 3200;/);
  assert.match(ui,/Math\.max\(3200,pauseMs\)-acousticSilence/);
  assert.match(speechPipeline,/hasInterim\?850:Math\.max\(600,analysis\.recommendedPauseMs\)/);
  assert.match(speechPipeline,/Math\.max\(analysis\.recommendedPauseMs,hasInterim\?2200:1600\)/);
});

test('FORZA hair animation remains visible during the spoken greeting despite microphone echo cancellation',()=>{
  assert.match(avatar,/Math\.max\(audioLvl, 0\.28\)/);
});

test('ending a call clears buffered audio segments from memory',()=>{
  const from=ui.indexOf('const releaseCallResources = useCallback');
  const to=ui.indexOf('useEffect(()=>()=>releaseCallResources()',from);
  assert.ok(from>0&&to>from);
  const teardown=ui.slice(from,to);
  assert.ok(teardown.includes('audioChunksRef.current=[]'));
  assert.ok(teardown.includes('audioSegmentsRef.current=[]'));
});

test('local Diba keeps one recognizer and appends finalized segments across reply boundaries',()=>{
  assert.match(ui,/if\(localSttRecognizerRef\.current\)\{/);
  assert.match(ui,/localSttAdmissionRef\.current=admission/);
  assert.match(ui,/appendForzaSpeechSegment\(localSttFinalRef\.current,recognized\.text\)/);
  assert.match(ui,/localSttAdmissionRef\.current\?\.reset\(\)/);
  assert.match(ui,/localSttActiveRef\.current=false/);
});

test('VAD waits for delayed speech text before stopping an empty transcript recording',()=>{
  assert.match(ui,/: 3200;/);
  assert.match(ui,/Math\.max\(0,Math\.max\(3200,pauseMs\)-acousticSilence\)/);
  assert.match(ui,/turnDispatchPendingRef\.current=true/);
  assert.match(ui,/const canInterruptPendingTurn=Boolean\(q&&\(/);
  assert.match(ui,/if\(turnDispatchPendingRef\.current&&!canInterruptPendingTurn\)return/);
});

test('Nima phrase requests are serialized to match the private single-worker CPU engine',()=>{
  assert.match(ui,/maxConcurrent:1/);
  assert.match(ui,/maxAheadPhrases:3/);
  assert.match(ui,/initialBufferSeconds:1\.6/);
  assert.match(ui,/maximumInitialWaitMs:450/);
  assert.match(ui,/AbortSignal\.timeout\(65000\)/);
  assert.match(ui,/phase=http_error status=/);
});

test('server AvalAI final verification with Diba fallback preserves browser text and merges recorder segments in order',()=>{
  assert.match(ui,/mapForzaSegmentsInOrder\(audioBlobs,2,async segment=>/);
  assert.match(ui,/Math\.ceil\(audioBlobs\.length\/2\)\*52_000/);
  assert.match(ui,/A failed final verifier must never erase a usable live transcript/);
  assert.match(ui,/serverTranscript=appendForzaSpeechSegment\(serverTranscript,result\.value\)/);
  assert.match(ui,/A failed final verifier must never erase a usable live transcript/);
});

test('voice readiness never blocks the first conversational text request',()=>{
  const from=ui.indexOf('const handleUserFinishedSpeaking = useCallback(');
  const to=ui.indexOf('// Setup MediaRecorder',from);
  const turn=ui.slice(from,to);
  const claim=turn.indexOf('activeTurnRef.current={generation,abort:pocketAbort,query:q,startedAt:Date.now()}');
  const request=turn.indexOf("fetch('/api/ai/consult-stream'");
  assert.ok(claim>=0&&request>claim);
  assert.doesNotMatch(turn,/await ensureVoiceMode\(\)/);
  assert.doesNotMatch(ui,/voiceInfoPromiseRef|ensureVoiceMode/);
  assert.match(turn,/if\(pocketAbort\.signal\.aborted \|\| activeTurnRef\.current\?\.generation!==generation\)return/);
});


test('TTS rate-limit responses distinguish a shared network ceiling from a single turn ceiling',()=>{
  assert.match(ui,/code==='forza_network_limit'/);
  assert.match(ui,/code==='forza_turn_limit'/);
  assert.match(ui,/pocket_rate_limited_network/);
  assert.match(ui,/pocket_rate_limited_turn/);
  assert.match(ui,/سقف درخواست صوتی این اتصال در یک دقیقه تکمیل شده است/);
});


test('each completed utterance is a separate request while the previous user and assistant turns remain context',()=>{
  assert.match(ui,/duplicateActiveTurn=Boolean\(q&&activeQuery&&activeTurn\?\.startedAt&&/);
  assert.match(ui,/Date\.now\(\)-activeTurn\.startedAt<2500/);
  assert.match(ui,/!vadRef\.current\.heardSpeech/);
  assert.match(ui,/activeTurnRef\.current=\{generation,abort:pocketAbort,query:q,startedAt:Date\.now\(\)\}/);
  assert.match(ui,/payload\.history=previousHistory/);
  assert.match(ui,/canReplacePendingHistory=Boolean\(q&&pendingHistoryTurnRef\.current===q/);
  assert.match(ui,/historyRef\.current=\[\.\.\.previousHistory,\{role:'user',text:resolvedUserQuery\}\]/);
  assert.match(ui,/query:resolvedUserQuery,\s+history:previousHistory/);
  assert.match(consult,/هر بار که کاربر پس از پایان واقعی گفتار، دوباره صحبت می‌کند، آن گفتار یک پیام مستقل/);
  assert.match(consult,/تمام پیام‌های قبلی کاربر و پاسخ‌های کامل FORZA در تاریخچه همین تماس حفظ می‌شوند/);
  assert.match(consult,/historyMessages = history\.slice\(-FORZA_CONVERSATION_HISTORY_LIMIT\)/);
});

test('the actual full assistant reply is retained in context regardless of TTS playback status',()=>{
  assert.match(ui,/const commitAssistantReply=\(text:string\)=>/);
  assert.match(ui,/commitAssistantReply\(reply\)/);
  assert.match(ui,/if\(heardEntry\)heardEntry\.text=clean/);
  assert.match(ui,/historyRef\.current\.push\(heardEntry\)/);
});

test('turn ownership prevents duplicate dispatch but a real interruption releases the next turn',()=>{
  assert.match(ui,/if\(duplicateActiveTurn\)return/);
  assert.match(ui,/turnDispatchPendingRef\.current=false;\s+active\.abort\.abort\(new Error\('forza_customer_interrupted'\)\)/);
  assert.match(ui,/turnDispatchPendingRef\.current=true/);
  assert.match(ui,/turnDispatchPendingRef\.current=false;\s+setStatus\('listening'\)/);
});

test('a delayed browser final for the just-submitted utterance does not barge in or create a duplicate turn',()=>{
  assert.match(ui,/recentLateFinal=Boolean\(activeTurn\?\.query&&/);
  assert.match(ui,/Date\.now\(\)-activeTurn\.startedAt<2500/);
  assert.match(ui,/!vadRef\.current\.heardSpeech/);
  assert.match(ui,/late_final_for_active_turn_ignored=1/);
});

test('MediaRecorder rotations keep collecting one long user utterance and retain audio for AvalAI final verification',()=>{
  assert.match(ui,/const wasRotation=rotateCapture/);
  assert.match(ui,/if\(wasRotation\)[\s\S]*?audioSegmentsRef\.current\.push\(completedSegment\)[\s\S]*?return;/);
  assert.match(ui,/!localSttActiveRef\.current\|\|serverSttProviderRef\.current==='avalai'/);
  assert.match(ui,/Math\.ceil\(audioBlobs\.length\/2\)\*52_000/);
});

test('final transcript selection trusts AvalAI only when the server did not fall back to Diba',()=>{
  assert.match(ui,/let serverUsedDibaFallback=false/);
  assert.match(ui,/sttData\?\.sttProvider==='diba-fallback'/);
  assert.match(ui,/preferAvalaiFinal=serverSttProviderRef\.current==='avalai'&&!serverUsedDibaFallback/);
  assert.match(ui,/chooseForzaFinalTranscript\(q,serverTranscript,preferAvalaiFinal\)/);
});

test('stop-command acknowledgements remain in the same call history for the next utterance',()=>{
  const stopBranch=ui.split("if(q && forzaTurnIntent(q)==='stop'){")[1]?.split("      // Claim the turn synchronously.")[0]||'';
  assert.match(stopBranch,/historyRef\.current=\[/);
  assert.match(stopBranch,/\{role:'user',text:q\}/);
  assert.match(stopBranch,/\{role:'model',text:stopReply\}/);
  assert.match(stopBranch,/const stopReply='بله، بفرما\.'/);
});
