/** Optional real-catalogue regression. Images and owner exports stay outside git.
 * LOCAL_VISION_OWNER_CASE points to a local manifest; no network downloads here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import sharp from 'sharp';
import {CatalogVisualIndex} from '../src/services/catalogVisualIndex';
import {describeLocalQuery,embedLocalImages,localVisionProfile,localVisionResult} from '../src/services/localVision';
import {prepareLocalQuery} from '../src/services/localQueryImage';
import type {CatalogImageRecord} from '../src/services/catalogImageCorpus';
import type {Product} from '../src/types';

test('owner photos retrieve the expected real catalogue family while negative controls stay empty', {skip:!process.env.LOCAL_VISION_OWNER_CASE,timeout:240000},async t=>{
 assert.ok(process.env.LOCAL_VISION_TEST_MODEL_DIR,'A provisioned offline model directory is required');
 const manifestPath=path.resolve(process.env.LOCAL_VISION_OWNER_CASE!);
 const fixture=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 const resolve=(file:string)=>path.resolve(path.dirname(manifestPath),file);
 const rows=JSON.parse(await fs.readFile(resolve(fixture.corpusFile),'utf8')) as CatalogImageRecord[];
 const products=JSON.parse(await fs.readFile(resolve(fixture.productsFile),'utf8')) as Product[];
 assert.ok(rows.length>=100,'Use a broad real catalogue, not only selected positive pictures');
 assert.ok(fixture.cases.length>=2,'Include positive and negative photographs');
 const reservation=http.createServer();await new Promise<void>(r=>reservation.listen(0,'127.0.0.1',r));
 const port=(reservation.address() as any).port;await new Promise<void>(r=>reservation.close(()=>r()));
 const env={...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',LOCAL_VISION_PORT:String(port),LOCAL_VISION_MODEL_DIR:process.env.LOCAL_VISION_TEST_MODEL_DIR!,LOCAL_VISION_TOKEN:'owner-regression-private-credential-32'};
 const worker=spawn(process.env.LOCAL_VISION_TEST_PYTHON || 'python3',['services/local-vision/worker.py'],{env,stdio:['ignore','ignore','pipe']});
 let errors='';worker.stderr.on('data',chunk=>{errors+=chunk;});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'owner-vision-'));
 const transport={LOCAL_VISION_URL:`http://127.0.0.1:${port}`,LOCAL_VISION_TOKEN:env.LOCAL_VISION_TOKEN,LOCAL_VISION_ENCODER:process.env.LOCAL_VISION_ENCODER};
 const profile=localVisionProfile(transport);
 try{
  let ready=false;
  for(let i=0;i<200;i++){
   if(worker.exitCode!==null)throw new Error('Encoder exited: '+errors.slice(-1000));
   try{if((await fetch(transport.LOCAL_VISION_URL+'/health')).ok){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,50));
  }
  assert.ok(ready);
  const index=new CatalogVisualIndex(path.join(dir,'index.json'),undefined,{model:profile.model,dimensions:profile.dimensions,batchSize:1,concurrency:1,imageSize:512});
  await index.update(rows,row=>fs.readFile(path.join(resolve(fixture.imagesDirectory),row.id)),buffers=>embedLocalImages(buffers,transport));
  for(const example of fixture.cases){
   const raw=example.blank?await sharp({create:{width:256,height:256,channels:3,background:'white'}}).jpeg().toBuffer():await fs.readFile(resolve(example.image));
   const input=await prepareLocalQuery(raw,example.region);
   const start=performance.now();const query=await describeLocalQuery(input,transport);
   const hits=(await index.rankVectors(query.vectors,rows,32,profile.maxViews>2))!;
   const result=localVisionResult(hits,products,index.coverage(rows),'/isolated-owner-test',profile.minSimilarity,query);
   t.diagnostic(JSON.stringify({case:example.name,indexed:rows.length,views:query.vectors.length,elapsedMs:Math.round(performance.now()-start),top:hits.slice(0,3).map(h=>({image:h.row.id,label:h.row.label,score:Number(h.score.toFixed(4))})),cards:result.modelSuggestions?.length}));
   if(example.expectedFamily){
    assert.ok(hits[0].row.bindings.some(b=>b.familyCode===example.expectedFamily),example.name+': wrong first family');
    assert.ok(result.catalogImageMatches?.[0]?.bindings.some(b=>b.familyCode===example.expectedFamily),example.name+': expected family filtered out');
    assert.ok((result.modelSuggestions?.filter(m=>m.familyCode===example.expectedFamily).length || 0)>=2,example.name+': multiple real models missing');
   }else{
    assert.deepEqual(result.catalogImageMatches,[],example.name+': unrelated photo generated suggestions');
    assert.deepEqual(result.modelSuggestions,[],example.name+': unrelated photo generated model cards');
   }
   assert.deepEqual(result.matchedProducts,[]);assert.equal(result.summary.exactVisualMatch,false);
  }
 }finally{
  worker.kill('SIGTERM');if(worker.exitCode===null)await new Promise<void>(r=>worker.once('exit',()=>r()));
  await fs.rm(dir,{recursive:true,force:true});
 }
});
