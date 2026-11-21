import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaRecognitionAdmission} from '../src/utils/forzaSpeechAdmission';
import {appendForzaSpeechSegment} from '../src/utils/forzaSpeechPipeline';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const endBody=source.split('      rec.onend = () => {')[1].split('\n      };')[0].replace('catch(error:any)','catch(error)');
function recognizerHarness(){
 const ref=(current:any)=>({current});let scheduled:(()=>void)|null=null,starts=0;
 const rec={start(){starts++;}};
 const retryTimer=ref(null);
 const scope:Record<string,any>={admissionRetry:null,rec,recognitionRef:ref(rec),isRecognitionActiveRef:ref(true),
  recognitionStartPendingRef:ref(false),recognitionStartWatchdogRef:ref(null),
  callClosedRef:ref(false),micMutedRef:ref(false),isCallActive:true,greetingFinishedRef:ref(true),
  recognitionFailedRef:ref(false),webSpeechFailedRef:ref(false),localSttRecognizerRef:ref(null),
  recognitionRetryTimerRef:retryTimer,setMicrophoneError:()=>{},
  canRestart:()=>!scope.callClosedRef.current&&!scope.micMutedRef.current&&scope.isCallActive&&
    scope.greetingFinishedRef.current&&!scope.recognitionFailedRef.current&&
    !scope.localSttRecognizerRef.current&&scope.recognitionRef.current===rec,
  scheduleRestart:(delay:number)=>{
    assert.equal(delay,200);
    if(retryTimer.current!==null||!scope.canRestart())return;
    retryTimer.current=1;
    scheduled=()=>{
      retryTimer.current=null;
      if(!scope.canRestart())return;
      starts++;
    };
  }};
 const end=new Function(...Object.keys(scope),endBody).bind(null,...Object.values(scope));
 return {scope,rec,end,fire:()=>scheduled?.(),starts:()=>starts};
}
test('recognizer restart snapshots the current transcript as the next session merge base',()=>{
  const body=source.split('      rec.onstart = () => {')[1].split('\n      };')[0];
  assert.match(body,/recognitionSessionBaseRef\.current=activeTranscriptRef\.current\.trim\(\)/);
});
test('normal recognizer end restarts once during playback as well as listening',()=>{
 const h=recognizerHarness();h.end();h.end();assert.equal(h.starts(),0);
 assert.equal(h.scope.recognitionRetryTimerRef.current,1);h.fire();assert.equal(h.starts(),1);
 assert.equal(h.scope.recognitionRetryTimerRef.current,null);
});
test('queued restart cannot revive a closed, muted, replaced or failed recognizer',()=>{
 for(const block of ['closed','muted','replaced','failed','local']){
  const h=recognizerHarness();h.end();
  if(block==='closed')h.scope.callClosedRef.current=true;
  if(block==='muted')h.scope.micMutedRef.current=true;
  if(block==='replaced')h.scope.recognitionRef.current={};
  if(block==='failed')h.scope.recognitionFailedRef.current=true;
  if(block==='local')h.scope.localSttRecognizerRef.current={};
  h.fire();assert.equal(h.starts(),0,block);
 }
});
test('old recognizer end cannot mark the replacement inactive or enqueue a restart',()=>{
 const h=recognizerHarness();h.scope.recognitionRef.current={};h.end();
 assert.equal(h.scope.isRecognitionActiveRef.current,true);
 assert.equal(h.scope.recognitionRetryTimerRef.current,null);
});
test('network recovery timer and permanent errors do not get a second onend retry loop',()=>{
 const h=recognizerHarness();h.scope.recognitionRetryTimerRef.current=77;h.end();
 assert.equal(h.scope.recognitionRetryTimerRef.current,77);h.fire();assert.equal(h.starts(),0);
 const failed=recognizerHarness();failed.scope.recognitionFailedRef.current=true;failed.end();
 assert.equal(failed.scope.recognitionRetryTimerRef.current,null);
});
test('empty recording without server STT does not create an AI turn or erase valid text',()=>{
 const body=source.split('      if(!q&&audioBlob&&serverSttConfiguredRef.current===false){')[1].split('\n      }')[0];
 const execute=new Function('recognitionFailedRef','webSpeechFailedRef','setMicrophoneError','startListening',body);
 let monitored=0,warnings=0;
 execute({current:false},{current:false},()=>warnings++,(monitor:boolean)=>{assert.equal(monitor,true);monitored++;});
 assert.equal(monitored,1);assert.equal(warnings,0);
 execute({current:true},{current:true},()=>warnings++,()=>{});assert.equal(warnings,1);
});

test('recognized interruption uses recent near-field VAD evidence after analyser reset and retires finalized echo', async()=>{
 const {extractPersianSpeechSince,checkpointForzaRecognition}=await import('../src/utils/forzaSpeechPipeline');
 const body=source.split('      rec.onresult = (event: any) => {')[1]
   .split("        if(!recognized.hasInterim&&forzaTurnIntent(currentSpeech)==='stop'){")[0];
 const ref=(current:any)=>({current});
 const rec={};
 let interrupted=0,echo=true;
 const scope:Record<string,any>={
  window:{location:{search:''}},admissionRetry:null,admissionSession:0,
  admission:new ForzaRecognitionAdmission(),speechAdmissionRef:ref({decide:()=> 'accept'}),rejectedRecordingRef:ref(false),
  rec,callClosedRef:ref(false),micMutedRef:ref(false),recognitionRef:ref(rec),
  recognitionConsumedCountRef:ref(0),recognitionResultCountRef:ref(0),recognitionSessionBaseRef:ref(''),appendForzaSpeechSegment,
  extractPersianSpeechSince,checkpointForzaRecognition,recognitionCheckpointRef:ref({count:0,interim:{}}),recognitionConsumedInterimRef:ref({}),recognitionRetryRef:ref(0),recognitionRetryTimerRef:ref(null),
  recognitionFailedRef:ref(false),webSpeechFailedRef:ref(false),
  setMicrophoneError:()=>{},setErrorNotice:()=>{},
  isProcessingTurnRef:ref(true),isAiSpeakingRef:ref(true),
  isManualReplayPendingRef:ref(false),vadRef:ref({heardSpeech:false}),lastMicActivityRef:ref(Date.now()),
  likelySpeakerEcho:()=>echo,interruptRequestRef:ref(()=>interrupted++),
  conversationEngineRef:ref({interruptWithSpeech:()=>true,updateTranscript:()=>''}),
 };
 const run=new Function(...Object.keys(scope),'event',body);
 const result=(text:string,isFinal=true)=>({0:{transcript:text},isFinal});
 const fire=(results:any[])=>run(...Object.values(scope),{results});
 fire([result('بلبرینگ مناسب موتور')]);
 assert.equal(interrupted,0);
 assert.equal(scope.recognitionCheckpointRef.current.count,1);
 assert.equal(scope.rejectedRecordingRef.current,true);
 echo=false;
 fire([result('بلبرینگ مناسب موتور'),result('صبر کن منظورم شش هزار و دویست و سه بود',false)]);
 assert.equal(interrupted,1);
 scope.recognitionRef.current={};
 fire([result('این رویداد قدیمی است')]);
 assert.equal(interrupted,1);
});
test('return to listening preserves a customer sentence without reopening raw microphone STT',()=>{
  const start=source.indexOf('const startListening = useCallback(');
  const block=source.indexOf('if(!monitorOnly){',start);
  const end=source.indexOf('// Only the foreground-gated stream may reach STT.',block);
  assert.ok(start>=0&&block>start&&end>block);
  const body=source.slice(block+'if(!monitorOnly){'.length,end).replace(/\\s*}\\s*$/,'');
  const execute=new Function('activeTranscriptRef','lastTranscriptChangedAtRef','hasSpeechSoundRef',
    'audioChunksRef','audioSegmentsRef','recognitionSessionBaseRef','setStatus','setTurn',body);
  const transcript={current:'ده عدد از همان می خواهم'};
  const changed={current:123},speech={current:true},chunks={current:['audio']};
  const segments={current:['segment']},session={current:'ده عدد از همان می خواهم'};
  execute(transcript,changed,speech,chunks,segments,session,()=>{},()=>{});
  assert.equal(transcript.current,'ده عدد از همان می خواهم');
  assert.equal(changed.current,123);
  assert.equal(speech.current,true);
  assert.deepEqual(chunks.current,['audio']);
  assert.deepEqual(segments.current,['segment']);
  assert.ok(source.includes('recognitionRef.current=null'));
 });
 
test('the start watchdog retries a recognizer that accepts start() but never emits onstart',()=>{
 assert.match(source,/recognitionStartWatchdogRef\.current=window\.setTimeout/);
 assert.match(source,/recognitionStartPendingRef\.current=false;\s*scheduleRestart\(450\)/);
 assert.match(source,/recognitionStartRef\.current=\(\)=>startWithWatchdog\(\)/);
});
test('a network failure uses capped recovery instead of permanently disabling later turns',()=>{
 assert.match(source,/const retryDelay=forzaRecognitionRetryDelay\(String\(error\),recognitionRetryRef\.current\)/);
 assert.match(source,/recognitionRetryRef\.current\+\+/);
 assert.match(source,/startWithWatchdog\(\)/);
});
