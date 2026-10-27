import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {RecognitionJobs} from '../src/services/recognitionJobs';
import {checkOfflineTechnicalSpecs} from '../src/services/offlineTechnicalMatch';

const tick=(ms=10)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(condition:()=>boolean,max=2500){
 const deadline=Date.now()+max;
 while(!condition()&&Date.now()<deadline)await tick();
 assert.ok(condition(),'Timed out waiting for recognition jobs');
}
test('recovered in-progress image analysis retains original job ID and eventually finishes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vision-durable-'));
 const store=path.join(dir,'jobs.json');
 try{
  let began=false;
  const first=new RecognitionJobs<string>(1,24,60000,store,()=>async()=>{began=true;return new Promise<string>(()=>{});});
  const id=first.startTask({imageUrl:'/imageai/sample.jpg',stage:'quick'});
  await waitFor(()=>began);
  assert.equal(first.get(id)?.status,'running');
  const restarted=new RecognitionJobs<string>(1,24,60000,store,payload=>async()=>String((payload as any).imageUrl)+' recovered');
  restarted.resumePending();
  await waitFor(()=>restarted.get(id)?.status==='complete');
  assert.equal(restarted.get(id)?.result,'/imageai/sample.jpg recovered');
  const reloaded=new RecognitionJobs<string>(1,24,60000,store,()=>async()=> 'not-run');
  assert.equal(reloaded.get(id)?.status,'complete');
  assert.equal(reloaded.get(id)?.result,'/imageai/sample.jpg recovered');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('ten incoming jobs are queued safely at one-worker concurrency',async()=>{
 let active=0,maxActive=0,processed=0;
 const jobs=new RecognitionJobs<number>(1,24,60000);
 const ids=Array.from({length:10},(_,i)=>jobs.start(async()=>{
  active++;maxActive=Math.max(maxActive,active);await tick(8);active--;processed++;return i;
 }));
 await waitFor(()=>ids.every(id=>jobs.get(id)?.status==='complete'),3000);
 assert.equal(processed,10);
 assert.equal(maxActive,1);
 assert.deepEqual(ids.map(id=>jobs.get(id)?.result),Array.from({length:10},(_,i)=>i));
});
test('measured industrial dimensions are checked only against registered comparable units',()=>{
 const specs=[{key:'عرض تسمه (mm)',value:'12.7'},{key:'طول بیرونی (mm)',value:'1268'},{key:'Teeth',value:'32'}];
 const match=checkOfflineTechnicalSpecs({width:'12.7',toothCount:'32'},specs,'SPA 1250');
 assert.equal(match.mismatches.length,0);
 assert.equal(match.compared,2);
 assert.equal(match.matches.length,2);
 const incompatible=checkOfflineTechnicalSpecs({width:'17',toothCount:'30',partCode:'SPA 1250'},specs,'SPB 1250');
 assert.equal(incompatible.mismatches.length,3);
 const unknown=checkOfflineTechnicalSpecs({width:'unknown',length:'1250'},[{key:'Length (inches)',value:'49.5'}]);
 assert.equal(unknown.compared,0);
 assert.equal(unknown.mismatches.length,0);
});
