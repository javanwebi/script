import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visualCatalogCards } from '../src/utils/visualCatalogCards';
import { createForzaStreamDeadline } from '../src/utils/forzaStreamDeadline';

test('returning to listening retains the answer until actual new speech', () => {
  const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  const expression=source.split('const showCustomerTranscript = ')[1].split(';')[0];
  const show=new Function('userText','isUserSpeaking','displayedAi',`return ${expression}`);
  assert.equal(show('previous question',false,'completed answer'),false);
  assert.equal(show('new speech',true,'completed answer'),true);
  assert.equal(show('new typed question',false,''),true);
});

test('a late autoplay unlock does not restart or demote a completed greeting', () => {
  const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  const body=source.split('const unlockAudio = useCallback(() => {')[1].split('    setVoiceOutputError(null);')[0];
  const phases:string[]=[];
  let unlocked=0;
  new Function('callClosedRef','ensureCtx','setAutoplayBlocked','greetingFinishedRef','setGreetingPhase',body)(
    {current:false},()=>++unlocked,()=>{},{current:true},(phase:string)=>phases.push(phase));
  assert.equal(unlocked,1);
  assert.deepEqual(phases,['complete']);
});

test('uncoded images and coded products share a ranking; duplicates and invalid scores do not', () => {
  const model:any = {code:'SKU',familyCode:'F',name:'coded',image:'/coded',matchBasis:'visual',visualScore:80,specs:[]};
  const photo = (imageId:string,score:number):any => ({imageId,image:'/'+imageId,label:imageId,score,bindings:[],reason:'visual'});
  const result=visualCatalogCards([model,{...model,code:'sibling',matchBasis:'family',visualScore:undefined}],
    [photo('unbound',95),photo('coded',80),photo('unbound',95),photo('bad',NaN)]);
  assert.deepEqual(result.map(item=>item.imageId||item.code),['unbound','SKU','sibling']);
  assert.equal(result[0].code,undefined);
  assert.equal(result[0].familyCode,'');
});

test('first token and idle timeouts are bounded; progress cannot extend the total deadline', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const first=createForzaStreamDeadline({firstMs:10,idleMs:10,totalMs:30});
  t.mock.timers.tick(10);
  assert.equal(first.signal.aborted,true);
  first.dispose();
  const idle=createForzaStreamDeadline({firstMs:10,idleMs:10,totalMs:30});
  t.mock.timers.tick(9);idle.progress();
  t.mock.timers.tick(9);assert.equal(idle.signal.aborted,false);
  t.mock.timers.tick(1);assert.equal(idle.signal.aborted,true);idle.dispose();
  const total=createForzaStreamDeadline({firstMs:10,idleMs:10,totalMs:25});
  for(let i=0;i<3;i++){t.mock.timers.tick(8);total.progress();}
  assert.equal(total.signal.aborted,false);
  t.mock.timers.tick(1);assert.equal(total.signal.aborted,true);total.dispose();
  const disposed=createForzaStreamDeadline({firstMs:10,totalMs:20});
  disposed.dispose();t.mock.timers.tick(100);assert.equal(disposed.signal.aborted,false);
});

test('voice preparation returning after hangup or supersession cannot send a request', async () => {
  const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  const start=source.indexOf('        await ensureVoiceMode();',source.indexOf('const pocketAbort=new AbortController();'));
  assert.ok(start>0,'voice preparation belongs to the cancellable turn');
  const guard=source.slice(start,source.indexOf('        const payload:',start));
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  for(const state of ['closed','aborted','superseded','active']){
    let release!:()=>void;
    const pending=new Promise<void>(resolve=>{release=resolve;});
    const closed={current:false},active={current:{generation:1}},controller=new AbortController();
    const run=new AsyncFunction('ensureVoiceMode','callClosedRef','pocketAbort','activeTurnRef','generation',guard+'return "send";');
    const result=run(()=>pending,closed,controller,active,1);
    if(state==='closed')closed.current=true;
    if(state==='aborted')controller.abort();
    if(state==='superseded')active.current={generation:2};
    release();
    assert.equal(await result,state==='active'?'send':undefined,state);
  }
});
