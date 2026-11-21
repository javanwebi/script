import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Execute the component's actual teardown against browser resource doubles.
// This covers early route exit, where greeting cleanup was never installed.
const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const body=source.split('const releaseCallResources = useCallback(() => {')[1].split('},[stopAudio,stopServerLiveStt]);')[0];
test('hangup cancels owned resources, detaches restart callbacks, and is repeatable',async()=>{
 const calls:string[]=[];
 let engineClosed=false;\n let serverLiveStopped=false;
 const ref=(current:any)=>({current});
 const recorder={state:'recording',onstop:()=>{},ondataavailable:()=>{},onerror:()=>{},stop(){assert.equal(this.onstop,null);calls.push('recorder');}};
 const track={onended:()=>{},stop(){assert.equal(this.onended,null);calls.push('track');}};
 const values:Record<string,any>={
  conversationEngineRef:ref({close(){if(!engineClosed){engineClosed=true;calls.push('conversation-engine');}}}),
  audioEvidenceCleanupRef:ref(()=>calls.push('audio-evidence')),speechAdmissionRef:ref({reset(){}}),
  playbackEchoHistoryRef:ref({clear(){}}),stopAcknowledgementRef:ref(null),callClosedRef:ref(false),microphoneGenerationRef:ref(1),micAutoStartedRef:ref(true),
  activeTurnRef:ref({abort:{abort(){calls.push('request');}}}),
  silenceTimerRef:ref(null),
  mediaRecorderRef:ref(recorder),streamRef:ref({getTracks:()=>[track]}),
  localSttRecognizerRef:ref({remove(){calls.push('local-stt');}}),
  localSttAdmissionRef:ref({reset(){calls.push('local-stt-admission-reset');}}),
  localSttActiveRef:ref(true),liveSttActiveRef:ref(true),serverLiveSttActiveRef:ref(true),
  speechStartedAtRef:ref(123),localSttFinalRef:ref('pending words'),turnDispatchPendingRef:ref(true),
  sessionTranscriptRef:ref('customer transcript'),pendingCommittedTranscriptRef:ref('pending'),pendingHistoryTurnRef:ref('pending'),
  localSttModelRef:ref({terminate(){calls.push('local-stt-model');}}),
  localSttModelLoadingRef:ref(true),
  animFrameAudioRef:ref(10),ctxRef:ref({state:'running',async close(){calls.push('context');}}),
  historyRef:ref(['private']),audioChunksRef:ref(['audio']),audioSegmentsRef:ref(['audio-segment']),isProcessingTurnRef:ref(true),
  stopAudio:()=>calls.push('playback'),stopServerLiveStt:()=>{if(!serverLiveStopped){serverLiveStopped=true;calls.push('server-live-stt');}},cancelAnimationFrame:()=>calls.push('animation'),
 };
 for(const name of ['localSttNodeRef','localSttSinkRef','micSourceNodeRef','micAnalyserRef','audioSourceNodeRef','analyserRef','gainNodeRef'])values[name]=ref({disconnect(){calls.push('disconnect');}});
 const teardown=new Function(...Object.keys(values),body).bind(null,...Object.values(values));
 teardown();teardown();await Promise.resolve();
 for(const resource of ['recorder','track','request','context','local-stt','local-stt-model','animation','audio-evidence','conversation-engine','server-live-stt'])assert.equal(calls.filter(x=>x===resource).length,1,resource);
 assert.equal(values.localSttModelRef.current,null);
 assert.equal(values.localSttAdmissionRef.current,null);
 assert.equal(values.localSttActiveRef.current,false);
 assert.equal(values.localSttFinalRef.current,'');
 assert.equal(values.turnDispatchPendingRef.current,false);
 assert.equal(values.sessionTranscriptRef.current,'');
 assert.equal(values.pendingCommittedTranscriptRef.current,'');
 assert.equal(values.pendingHistoryTurnRef.current,'');
 assert.equal(values.localSttModelLoadingRef.current,false);
 assert.equal(values.callClosedRef.current,true);
 assert.equal(values.microphoneGenerationRef.current,3);
 assert.equal(values.ctxRef.current,null);
 assert.deepEqual(values.historyRef.current,[]);
 assert.deepEqual(values.audioChunksRef.current,[]);
 assert.deepEqual(values.audioSegmentsRef.current,[]);
 assert.equal(values.isProcessingTurnRef.current,false);
});

test('late microphone permission result is stopped before attaching to a closed or superseded call',()=>{
 const guard=source.split('acquiredStream=await navigator.mediaDevices.getUserMedia')[1]
  .split('      streamRef.current?.getTracks()')[0];
 const body=guard.slice(guard.indexOf('      if(callClosedRef.current'));
 const accept=new Function('callClosedRef','microphoneGeneration','microphoneGenerationRef','acquiredStream','stopServerLiveStt',body+'; return true;');
 for(const [closed,generation] of [[true,1],[false,2]] as const){
  let stopped=0;
  assert.equal(accept({current:closed},1,{current:generation},{getTracks:()=>[{stop:()=>++stopped}]},()=>{}),undefined);
  assert.equal(stopped,1);
 }
 assert.equal(accept({current:false},1,{current:1},{getTracks:()=>{throw Error('must keep valid stream');}},()=>{}),true);
});


test('a Diba model that resolves after hangup is terminated instead of retained',()=>{
 assert.match(source,/if\(callClosedRef\.current\)\{model\.terminate\?\.\(\);return;\}/);
 assert.match(source,/if\(callClosedRef\.current\)return;[\s\S]*?finally\(\(\)=>\{localSttModelLoadingRef\.current=false;\}\)/);
});
