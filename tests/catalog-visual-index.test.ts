import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {CatalogVisualIndex} from '../src/services/catalogVisualIndex';
const row=(id:string,revision='1')=>({id,url:'https://example.org/'+id,label:id,revision,bindings:[]});
const vector=(index:number)=>Array.from({length:768},(_,i)=>i===index?1:0);
test('persistent visual index ranks every indexed image, reuses vectors and requires new images to be indexed',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-index-'));const file=path.join(dir,'index.json');
 const image=await sharp({create:{width:24,height:24,channels:3,background:'white'}}).jpeg().toBuffer();
 const images=[row('a'),row('b')];let builds=0;
 const index=new CatalogVisualIndex(file);
 assert.equal(await index.retrieve(image,images,async()=>[vector(1)]),null);
 await index.update(images,async()=>image,async buffers=>{builds+=buffers.length;return [vector(0),vector(1)];});
 assert.equal(builds,2);assert.equal(index.coverage(images).ready,true);
 const loaded=new CatalogVisualIndex(file);
 assert.equal((await loaded.retrieve(image,images,async()=>[vector(1)],1))![0].id,'b');
 await loaded.update(images,async()=>{throw new Error('unchanged files must not reload');},async()=>{throw new Error('unchanged images must not re-embed');});
 assert.equal(await loaded.retrieve(image,[...images,row('new')],async()=>[vector(1)]),null);
 assert.equal(loaded.coverage([row('a','changed'),row('b')]).indexed,1);
 await assert.rejects(()=>loaded.retrieve(image,images,async()=>[[NaN]]));
 await fs.rm(dir,{recursive:true});
});
test('a partial embedding batch cannot be reported as a complete catalogue index',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-index-failure-'));
 const index=new CatalogVisualIndex(path.join(dir,'index.json'));const rows=[row('missing')];
 await assert.rejects(()=>index.update(rows,async()=>null,async()=>[]));
 assert.deepEqual(index.coverage(rows),{total:1,indexed:0,ready:false});
 await fs.rm(dir,{recursive:true});
});
test('local 384-dimensional index isolates model versions, returns scores and invalidates edited photos',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'local-index-'));
 try{
  const file=path.join(dir,'index.json'),opts={model:'local-v1',dimensions:384,batchSize:1,concurrency:1};
  const image=await sharp({create:{width:24,height:24,channels:3,background:'white'}}).jpeg().toBuffer();
  const local=(i:number)=>Array.from({length:384},(_,j)=>i===j?1:0);
  const index=new CatalogVisualIndex(file,undefined,opts);let n=0;
  await index.update([row('a'),row('b')],async()=>image,async buffers=>{assert.equal(buffers.length,1);return [local(n++)];});
  const ranked=await index.rank(image,[row('a'),row('b')],async()=>[local(1)]);
  assert.equal(ranked![0].row.id,'b');assert.equal(ranked![0].score,1);
  const changed=new CatalogVisualIndex(file,undefined,{...opts,model:'local-v2'});await changed.load();
  assert.equal(changed.coverage([row('a'),row('b')]).indexed,0);
  assert.equal(await index.rank(image,[row('a','edit'),row('b')],async()=>[local(1)]),null);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('database index loading fails closed and can retry after an outage',async()=>{
 let failed=true;
 const index=new CatalogVisualIndex('unused',{loadEntries:async()=>{if(failed)throw new Error('database unavailable');return {};},saveEntries:async()=>{}});
 await assert.rejects(()=>index.load(),/database unavailable/);failed=false;await index.load();
 assert.equal(index.coverage([row('a')]).ready,false);
});
test('a foreground query can retrieve an object hidden by full-frame background without losing full-frame candidates',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'multi-query-'));
 try{
  const index=new CatalogVisualIndex(path.join(dir,'index.json'),undefined,{model:'local',dimensions:2,batchSize:1,concurrency:1});
  const image=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).jpeg().toBuffer();
  let i=0;await index.update([row('background'),row('object')],async()=>image,async()=>[i++===0?[1,0]:[0,1]]);
  const hits=await index.rankVectors([[0.6,0.8],[0,1]],[row('background'),row('object')]);
  assert.equal(hits![0].row.id,'object');assert.equal(hits![0].viewScores.length,2);
  await assert.rejects(()=>index.rankVectors([[NaN,0]],[row('object')]));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('DINOv2 blends full-frame context with the strongest crop while MobileCLIP keeps independent-view ranking',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'independent-query-'));
 try{
  const index=new CatalogVisualIndex(path.join(dir,'index.json'),undefined,{model:'local',dimensions:2,batchSize:1,concurrency:1});
  const image=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).jpeg().toBuffer();
  let i=0;const rows=[row('background'),row('object')];
  await index.update(rows,async()=>image,async()=>[i++===0?[1,0]:[0,1]]);
  const views=[[0.6,0.8],[0,1],[-1,0],[0,-1]];
  const blended=(await index.rankVectors(views,rows))!;
  assert.equal(blended[0].row.id,'object');
  assert.equal(blended[0].viewScores.length,4);
  assert.ok(Math.abs(blended[0].score-0.95)<1e-9);
  const independent=(await index.rankVectors(views,rows,48,true))!;
  assert.equal(independent[0].row.id,'object');
  assert.equal(independent[0].score,1);
  await assert.rejects(()=>index.rankVectors(Array(5).fill([0,1]),rows),/views/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('an unreadable catalogue image does not block later rows and is resumed on the next pass',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'index-resume-'));
 try{
  const index=new CatalogVisualIndex(path.join(dir,'index.json'),undefined,{model:'local',dimensions:2,batchSize:1,concurrency:1});
  const image=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).jpeg().toBuffer();
  const rows=[row('unavailable-first'),row('available-second')];
  await index.update(rows,async item=>item.id==='unavailable-first'?null:image,async buffers=>buffers.map(()=>[1,0]));
  assert.deepEqual(index.coverage(rows),{total:2,indexed:1,ready:false});
  assert.equal(await index.rankVectors([[1,0]],rows),null);
  await index.update(rows,async()=>image,async buffers=>buffers.map(()=>[0,1]));
  assert.deepEqual(index.coverage(rows),{total:2,indexed:2,ready:true});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('a failed durable write never reports an in-memory-only index as ready',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'index-durable-'));
 try{
  let fail=true;
  const persistence={
   async loadEntries(){return {};},
   async saveEntries(_entries:unknown[]){if(fail){fail=false;throw new Error('simulated persistence failure');}}
  };
  const index=new CatalogVisualIndex(path.join(dir,'unused.json'),persistence,{model:'local',dimensions:2,batchSize:1,concurrency:1});
  const image=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).jpeg().toBuffer();
  const rows=[row('persisted')];
  await assert.rejects(index.update(rows,async()=>image,async()=>[[1,0]]),/simulated persistence failure/);
  assert.deepEqual(index.coverage(rows),{total:1,indexed:0,ready:false});
  await index.update(rows,async()=>image,async()=>[[1,0]]);
  assert.deepEqual(index.coverage(rows),{total:1,indexed:1,ready:true});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
