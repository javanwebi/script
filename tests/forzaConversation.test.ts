import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinForzaRecognitionSession, shouldAcknowledgeForzaPause } from '../src/utils/forzaConversation';
import { forzaEndOfTurnPauseMs } from '../src/utils/forzaSpeechPipeline';
import { buildForzaConsultSystemMessage } from '../server/ai/baiConsult';
const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');

test('a reconnect preserves the first clause while new word hypotheses remain revisable',()=>{
  const prefix='برای موتور خط تولید';
  assert.equal(joinForzaRecognitionSession(prefix,'بلبرینگ'),'برای موتور خط تولید بلبرینگ');
  assert.equal(joinForzaRecognitionSession(prefix,'بلبرینگ 6203ZZ میخواهم'),
    'برای موتور خط تولید بلبرینگ 6203ZZ میخواهم');
  assert.equal(joinForzaRecognitionSession('', 'صبر کن'), 'صبر کن');
});
test('actual recognition onstart snapshots only the pending customer utterance',()=>{
  const body=source.split('      rec.onstart = () => {')[1].split('\n      };')[0];
  const ref=(current:any)=>({current}); const rec={abort(){throw Error('unexpected abort');}};
  const scope:any={rec,callClosedRef:ref(false),micMutedRef:ref(false),recognitionRef:ref(rec),
    recognitionFailedRef:ref(true),webSpeechFailedRef:ref(true),setMicrophoneError:()=>{},
    isRecognitionActiveRef:ref(false),recognitionSessionPrefixRef:ref(''),
    activeTranscriptRef:ref('برای موتور خط تولید'),recognitionConsumedInterimRef:ref({}),
    recognitionCheckpointRef:ref({}),recognitionResultCountRef:ref(5),recognitionConsumedCountRef:ref(5)};
  const run=()=>new Function(...Object.keys(scope),body)(...Object.values(scope));
  run(); assert.equal(scope.recognitionSessionPrefixRef.current,'برای موتور خط تولید');
  scope.activeTranscriptRef.current='';run();assert.equal(scope.recognitionSessionPrefixRef.current,'');
});
test('natural feedback requires a real stable pause and a multiword unfinished thought',()=>{
  const text='برای موتور خط تولید که';
  assert.equal(shouldAcknowledgeForzaPause(text,400,400,10000),true);
  for(const args of [[100,400,10000],[400,0,10000],[400,1000,10000],[400,400,500]])
    assert.equal(shouldAcknowledgeForzaPause(text,args[0],args[1],args[2]),false);
  assert.equal(shouldAcknowledgeForzaPause('قیمت این بلبرینگ چنده',500,500,10000),false);
  assert.equal(shouldAcknowledgeForzaPause('صبر کن صبر کن',500,500,10000),false);
});
test('local finalized speaker echo never enters the cumulative customer transcript',()=>{
  const body=source.split('        const words=value.trim();')[1].split('        const vadReady')[0];
  const final={current:''};
  const run=new Function('words','isFinal','localSttFinalRef','likelySpeakerEcho',body+'return transcript;');
  assert.equal(run('صدای فورزا',true,final,(t:string)=>t==='صدای فورزا'),undefined);
  assert.equal(final.current,'');
  assert.equal(run('نه منظورم',true,final,()=>false),'نه منظورم');
  assert.equal(run('6203ZZ بود',false,final,()=>false),'نه منظورم 6203ZZ بود');
});
test('voice prompt asks for grounded understanding and respects unfinished requests',()=>{
  const prompt=buildForzaConsultSystemMessage(true);
  assert.match(prompt,/اصلاح تازه مشتری/);
  assert.match(prompt,/هنوز توضیحش تمام نشده/);
  assert.match(prompt,/جزئیات نامفهوم را حدس نزنید/);
});

test('stop yields promptly but a correction beginning with stop retains its sentence',()=>{
  assert.equal(forzaEndOfTurnPauseMs('وایسا',false),350);
  assert.equal(forzaEndOfTurnPauseMs('صبر کن',true),500);
  assert.ok(forzaEndOfTurnPauseMs('صبر کن منظورم',true)>1500);
});

test('local recognizer failure releases failed worker and recovers once, ignoring stale errors',()=>{
  const body=source.split("      recognizer.on('error',()=>{")[1].split('\n      });')[0];
  let removed=0,recovered=0;
  const recognizer={remove(){removed++;}};
  const active={current:recognizer as any}, model={current:{} as any};
  const run=new Function('recognizer','localSttRecognizerRef','localSttModelRef','setLocalSttStatus','recoverBrowserSttRef',body);
  const recover={current(){recovered++;}};
  run(recognizer,active,model,()=>{},recover);
  run(recognizer,active,model,()=>{},recover);
  assert.equal(removed,1);assert.equal(recovered,1);
  assert.equal(active.current,null);assert.equal(model.current,null);
});
