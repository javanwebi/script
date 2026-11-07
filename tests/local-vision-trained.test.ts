import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {CatalogVisualIndex} from '../src/services/catalogVisualIndex';
import {describeLocalQuery,embedLocalImages,geometricEvidence,rankLocalEvidence,localVisionResult,LOCAL_VISION_MODEL} from '../src/services/localVision';
import {prepareLocalQuery} from '../src/services/localQueryImage';
import type {Product} from '../src/types';

test('trained offline encoder → multi-view retrieval → geometric reranking → real bound catalogue cards', {skip:!process.env.LOCAL_VISION_TEST_MODEL_DIR,timeout:30000},async()=>{
 const reservation=http.createServer();await new Promise<void>(r=>reservation.listen(0,'127.0.0.1',r));
 const port=(reservation.address() as any).port;await new Promise<void>(r=>reservation.close(()=>r()));
 const env={...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',LOCAL_VISION_MODEL_DIR:process.env.LOCAL_VISION_TEST_MODEL_DIR!,LOCAL_VISION_PORT:String(port),LOCAL_VISION_TOKEN:'isolated-test-service-credential-32'};
 const worker=spawn(process.env.LOCAL_VISION_TEST_PYTHON || 'python3',['services/local-vision/worker.py'],{env,stdio:['ignore','ignore','pipe']});
 let errors='';worker.stderr.on('data',chunk=>{errors+=chunk;});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'trained-local-'));
 const transport={LOCAL_VISION_URL:`http://127.0.0.1:${port}`,LOCAL_VISION_TOKEN:env.LOCAL_VISION_TOKEN};
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   if(worker.exitCode!==null)throw new Error('Encoder exited: '+errors.slice(-1000));
   try{const r=await fetch(transport.LOCAL_VISION_URL+'/health');if(r.ok){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,50));
  }
  assert.ok(ready,'trained encoder did not start');
  const make=async(seed:number)=>{
   const raw=Buffer.alloc(256*256*3);let state=seed;
   for(let i=0;i<raw.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;raw[i]=state>>>24;}
   return prepareLocalQuery(await sharp(raw,{raw:{width:256,height:256,channels:3}}).png().toBuffer());
  };
  const image=await make(11),other=await make(91);
  const rows=['expected','other'].map(id=>({id,url:'/catalog/'+id+'.jpg',label:id,revision:'1',bindings:[{familyCode:id,code:id+'-sku',verified:false}]}));
  const index=new CatalogVisualIndex(path.join(dir,'index.json'),undefined,{model:LOCAL_VISION_MODEL,dimensions:384,batchSize:1,concurrency:1,imageSize:512});
  await index.update(rows,async row=>row.id==='expected'?image:other,images=>embedLocalImages(images,transport));
  const query=await describeLocalQuery(image,transport);
  const hits=(await index.rankVectors(query.vectors,rows))!;assert.equal(hits[0].row.id,'expected');
  const evidence=await geometricEvidence(image,hits.map(hit=>hit.row.id==='expected'?image:other),transport);
  const enriched=hits.map((hit,i)=>({...hit,geometry:evidence[i]}));
  assert.equal(enriched[0].geometry.supported,true);
  assert.equal(enriched[1].geometry.supported,false);
  const products=rows.map(row=>({code:row.id,name:row.id,active:true,variants:[{code:row.id+'-sku',name:row.id,active:true}]})) as Product[];
  const result=localVisionResult(rankLocalEvidence(enriched,products,query.markings),products,index.coverage(rows),'/customer',0.65,query);
  assert.equal(result.similarCandidates![0].code,'expected-sku');
  assert.deepEqual(result.matchedProducts,[]);assert.equal(result.summary.exactVisualMatch,false);
 }finally{
  worker.kill('SIGTERM');if(worker.exitCode===null)await new Promise<void>(r=>worker.once('exit',()=>r()));
  await fs.rm(dir,{recursive:true,force:true});
 }
});
