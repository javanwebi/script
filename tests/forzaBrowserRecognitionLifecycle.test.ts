import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const endBody=source.split('      rec.onend = () => {')[1].split('\n      };')[0].replace('catch(error:any)','catch(error)');
function recognizerHarness(){
 const ref=(current:any)=>({current});let scheduled:(()=>void)|null=null,starts=0;
 const rec={start(){starts++;}};
 const scope:Record<string,any>={rec,recognitionRef:ref(rec),isRecognitionActiveRef:ref(true),
  callClosedRef:ref(false),micMutedRef:ref(false),isCallActive:true,greetingFinishedRef:ref(true),
  recognitionFailedRef:ref(false),webSpeechFailedRef:ref(false),localSttRecognizerRef:ref(null),
  recognitionRetryTimerRef:ref(null),setMicrophoneError:()=>{},
  window:{setTimeout(fn:()=>void,delay:number){assert.equal(delay,200);scheduled=fn;return 1;}}};
 const end=new Function(...Object.keys(scope),endBody).bind(null,...Object.values(scope));
 return {scope,rec,end,fire:()=>scheduled?.(),starts:()=>starts};
}
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
