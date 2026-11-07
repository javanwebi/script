import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {localVisionResult,embedLocalImages,LOCAL_VISION_MODEL} from '../src/services/localVision';
import type {Product} from '../src/types';

const products=[{code:'family',name:'خانواده واقعی',active:true,variants:[{code:'sku',name:'کالای واقعی',active:true,technicalSpecs:[{key:'سایز',value:'20'}]},{code:'other-size',active:true},{code:'inactive',active:false}]}] as Product[];
const hit=(bindings:any[],score=0.9)=>({score,row:{id:'photo',url:'/storage/real.webp',revision:'1',label:'قطعه',bindings}});
const coverage={total:1,indexed:1,ready:true};
test('family images produce navigable family bindings, never an arbitrary SKU or an exact claim',()=>{
 const result=localVisionResult([hit([{familyCode:'family',verified:false}])],products,coverage,'/customer');
 assert.equal(result.catalogImageMatches!.length,1);
 assert.equal(result.catalogImageMatches![0].bindings[0].familyCode,'family');
 assert.deepEqual(result.similarCandidates,[]);assert.deepEqual(result.matchedProducts,[]);
 assert.equal(result.summary.exactVisualMatch,false);assert.equal(result.summary.confidence,0);
});
test('only active, explicitly bound real SKUs are returned, even when the photo is identity verified',()=>{
 const result=localVisionResult([hit([{familyCode:'family',code:'sku',verified:true},{familyCode:'family',code:'invented',verified:true},{familyCode:'family',code:'inactive',verified:true},{familyCode:'deleted',code:'sku',verified:true}])],products,coverage,'/customer');
 assert.deepEqual(result.similarCandidates!.map(p=>p.code),['sku']);
 assert.deepEqual(result.similarCandidates![0].specs,[{key:'سایز',value:'20'}]);
 assert.equal(result.similarCandidates![0].visualVerdict,'very_similar');
 assert.deepEqual(result.matchedProducts,[]);
 assert.equal(result.catalogImageMatches![0].bindings.length,1);
});
test('weak or invalid similarity yields no invented nearest match or absence/stock claim',()=>{
 const result=localVisionResult([hit([],0.4),hit([],NaN)],products,coverage,'/customer');
 assert.deepEqual(result.catalogImageMatches,[]);assert.deepEqual(result.similarCandidates,[]);
 assert.match(result.summary.catalogAvailability!.statusFarsiMessage,/عکس واضح‌تر/);
});
test('local embedding HTTP transport sends private bytes only to configured local encoder and validates its space',async()=>{
 let bad=false,requests=0;
 const server=http.createServer(async(req,res)=>{
  requests++;assert.equal(req.url,'/embed');assert.equal(req.headers.authorization,'Bearer private-local-token');
  let raw='';for await(const chunk of req)raw+=chunk;
  assert.deepEqual(JSON.parse(raw).images,['cmVhbCBwaG90bw==']);
  res.setHeader('content-type','application/json');res.end(JSON.stringify({model:bad?'wrong-model':LOCAL_VISION_MODEL,vectors:[Array(384).fill(0.1)]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const env={LOCAL_VISION_URL:`http://127.0.0.1:${(server.address() as any).port}`,LOCAL_VISION_TOKEN:'private-local-token'};
  assert.equal((await embedLocalImages([Buffer.from('real photo')],env))[0].length,384);
  bad=true;await assert.rejects(()=>embedLocalImages([Buffer.from('real photo')],env),/mismatch/);
  await assert.rejects(()=>embedLocalImages([Buffer.from('real photo')],{...env,LOCAL_VISION_TOKEN:''}),/authentication/);
  assert.equal(requests,2);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
