import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Execute the component's actual teardown against browser resource doubles.
// This covers early route exit, where greeting cleanup was never installed.
const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const body=source.split('const releaseCallResources = useCallback(() => {')[1].split('},[stopAudio]);')[0];
test('hangup cancels owned resources, detaches restart callbacks, and is repeatable',async()=>{
 const calls:string[]=[];
 const ref=(current:any)=>({current});
 const recognition={onend:()=>{},onerror:()=>{},onresult:()=>{},abort(){assert.equal(this.onend,null);calls.push('recognition');}};
 const recorder={state:'recording',onstop:()=>{},ondataavailable:()=>{},onerror:()=>{},stop(){assert.equal(this.onstop,null);calls.push('recorder');}};
 const track={onended:()=>{},stop(){assert.equal(this.onended,null);calls.push('track');}};
 const values:Record<string,any>={
  audioEvidenceCleanupRef:ref(()=>calls.push('audio-evidence')),speechAdmissionRef:ref({reset(){}}),
  playbackEchoHistoryRef:ref({clear(){}}),stopAcknowledgementRef:ref(null),callClosedRef:ref(false),microphoneGenerationRef:ref(1),micAutoStartedRef:ref(true),
  activeTurnRef:ref({abort:{abort(){calls.push('request');}}}),
  silenceTimerRef:ref(null),recognitionRetryTimerRef:ref(null),
  recognitionRef:ref(recognition),isRecognitionActiveRef:ref(true),
  mediaRecorderRef:ref(recorder),streamRef:ref({getTracks:()=>[track]}),
  localSttRecognizerRef:ref({remove(){calls.push('local-stt');}}),
  animFrameAudioRef:ref(10),ctxRef:ref({state:'running',async close(){calls.push('context');}}),
  historyRef:ref(['private']),audioChunksRef:ref(['audio']),isProcessingTurnRef:ref(true),
  stopAudio:()=>calls.push('playback'),cancelAnimationFrame:()=>calls.push('animation'),
 };
 for(const name of ['localSttNodeRef','localSttSinkRef','micSourceNodeRef','micAnalyserRef','audioSourceNodeRef','analyserRef','gainNodeRef'])values[name]=ref({disconnect(){calls.push('disconnect');}});
 const teardown=new Function(...Object.keys(values),body).bind(null,...Object.values(values));
 teardown();teardown();await Promise.resolve();
 for(const resource of ['recognition','recorder','track','request','context','local-stt','animation','audio-evidence'])assert.equal(calls.filter(x=>x===resource).length,1,resource);
 assert.equal(values.callClosedRef.current,true);
 assert.equal(values.microphoneGenerationRef.current,3);
 assert.equal(values.ctxRef.current,null);
 assert.deepEqual(values.historyRef.current,[]);
 assert.deepEqual(values.audioChunksRef.current,[]);
 assert.equal(values.isProcessingTurnRef.current,false);
});

test('late microphone permission result is stopped before attaching to a closed or superseded call',()=>{
 const guard=source.split('const stream=await navigator.mediaDevices.getUserMedia')[1]
  .split('      streamRef.current?.getTracks()')[0];
 const body=guard.slice(guard.indexOf('      if(callClosedRef.current'));
 const accept=new Function('callClosedRef','microphoneGeneration','microphoneGenerationRef','stream',body+'; return true;');
 for(const [closed,generation] of [[true,1],[false,2]] as const){
  let stopped=0;
  assert.equal(accept({current:closed},1,{current:generation},{getTracks:()=>[{stop:()=>++stopped}]}),undefined);
  assert.equal(stopped,1);
 }
 assert.equal(accept({current:false},1,{current:1},{getTracks:()=>{throw Error('must keep valid stream');}}),true);
});
