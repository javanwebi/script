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
test('OCR family hints and geometric evidence rerank close visual matches without rescuing weak images or certifying identity',async()=>{
 const {rankLocalEvidence}=await import('../src/services/localVision');
 const p=[{code:'family',active:true,variants:[{code:'6203ZZ',active:true}]}] as Product[];
 const weak={...hit([{familyCode:'family',verified:false}],0.56),geometry:{supported:true,inliers:30,coverage:0.4}};
 const ranked=rankLocalEvidence([weak],p,[{text:'6203ZZ',confidence:96}]);
 assert.equal(ranked[0].codeHint,true);assert.ok(ranked[0].score>0.65);
 const result=localVisionResult(ranked,p,coverage,'/customer');assert.deepEqual(result.catalogImageMatches,[]);
 const ambiguous=[...p,{code:'other',active:true,variants:[{code:'6203-ZZ',active:true}]}] as Product[];
 assert.equal(rankLocalEvidence([weak],ambiguous,[{text:'6203ZZ',confidence:96}])[0].codeHint,false);
});
test('result diversity retains another family instead of filling every slot with one family',()=>{
 const hits=[0.97,0.96,0.95].map((score,i)=>({score,row:{...hit([{familyCode:'family',verified:false}]).row,id:'a'+i}}));
 hits.push({score:0.955,row:{...hit([{familyCode:'other',verified:false}]).row,id:'b'}});
 const result=localVisionResult(hits.sort((a,b)=>b.score-a.score),[...products,{code:'other',name:'خانواده دوم',active:true,variants:[]}] as Product[],{total:4,indexed:4,ready:true},'/customer');
 assert.equal(result.catalogImageMatches!.length,3);
 assert.ok(result.catalogImageMatches!.some(photo=>photo.imageId==='b'));
 assert.match(result.summary.detectedPartType,/چند خانواده/);
});
test('a confident OCR code suggests only a unique real SKU in a visually eligible family, never a confirmed match',()=>{
 const p=[{code:'family',name:'بلبرینگ',active:true,variants:[{code:'6203ZZ',name:'بلبرینگ واقعی',active:true}]}] as Product[];
 const q={vectors:[],markings:[{text:'6203ZZ',confidence:96}],ocrAvailable:true};
 const result=localVisionResult([hit([{familyCode:'family',verified:false}],0.9)],p,coverage,'/customer',0.65,q);
 assert.equal(result.similarCandidates![0].code,'6203ZZ');assert.equal(result.similarCandidates![0].matchType,'combined');
 assert.deepEqual(result.matchedProducts,[]);
 const weak=localVisionResult([hit([{familyCode:'family',verified:false}],0.4)],p,coverage,'/customer',0.65,q);
 assert.deepEqual(weak.similarCandidates,[]);
});
test('extended local query transport validates protocol, crop and bounded geometric response',async()=>{
 const {describeLocalQuery,geometricEvidence,LOCAL_VISION_PIPELINE}=await import('../src/services/localVision');
 let broken=false;
 const server=http.createServer(async(req,res)=>{
  for await(const _chunk of req){};
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(req.url==='/query'?{model:LOCAL_VISION_MODEL,pipeline:LOCAL_VISION_PIPELINE,vectors:[Array(384).fill(0.1)],region:broken?{x:-1,y:0,width:1,height:1}:null,markings:[{text:'6203ZZ',confidence:96}],ocrAvailable:true}:{model:LOCAL_VISION_MODEL,pipeline:LOCAL_VISION_PIPELINE,evidence:[{supported:true,inliers:20,coverage:0.3}]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const env={LOCAL_VISION_URL:`http://127.0.0.1:${(server.address() as any).port}`,LOCAL_VISION_TOKEN:'private-local-token'};
  assert.equal((await describeLocalQuery(Buffer.from('photo'),env)).markings[0].text,'6203ZZ');
  assert.equal((await geometricEvidence(Buffer.from('photo'),[Buffer.from('candidate')],env))[0].supported,true);
  broken=true;await assert.rejects(()=>describeLocalQuery(Buffer.from('photo'),env),/Invalid local query/);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('MobileCLIP uses an isolated 512-dimensional space and validates bounded crop metadata',async()=>{
 const {localVisionProfile,describeLocalQuery}=await import('../src/services/localVision');
 assert.notEqual(localVisionProfile({LOCAL_VISION_ENCODER:'mobileclip2-s0'}).model,LOCAL_VISION_MODEL);
 assert.throws(()=>localVisionProfile({LOCAL_VISION_ENCODER:'unknown'}),/Unsupported/);
 let broken=false;
 const profile=localVisionProfile({LOCAL_VISION_ENCODER:'mobileclip2-s0'});
 const server=http.createServer(async(req,res)=>{
  for await(const _chunk of req){};
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({model:profile.model,pipeline:profile.pipeline,vectors:[Array(512).fill(0.1),Array(512).fill(0.1)],viewRegions:broken?[null]:[null,{x:0.4,y:0.3,width:0.2,height:0.3}],region:null,markings:[],ocrAvailable:false}));
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{
  const env={LOCAL_VISION_ENCODER:'mobileclip2-s0',LOCAL_VISION_URL:`http://127.0.0.1:${(server.address() as any).port}`,LOCAL_VISION_TOKEN:'private-local-token'};
  assert.equal((await describeLocalQuery(Buffer.from('photo'),env)).vectors[0].length,512);
  await assert.rejects(()=>describeLocalQuery(Buffer.from('photo'),{...env,LOCAL_VISION_ENCODER:'dinov2-small'}),/mismatch/);
  broken=true;await assert.rejects(()=>describeLocalQuery(Buffer.from('photo'),env),/regions/);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test('moderate MobileCLIP evidence needs multiple distinct photos in one family; a lone texture match stays empty',async()=>{
 const {localVisionProfile}=await import('../src/services/localVision');
 const query={model:localVisionProfile({LOCAL_VISION_ENCODER:'mobileclip2-s0'}).model,vectors:[],markings:[],ocrAvailable:false};
 const bound=hit([{familyCode:'family',verified:false}],0.57);
 const lone=localVisionResult([bound],products,coverage,'/customer',0.55,query);
 assert.deepEqual(lone.catalogImageMatches,[]);assert.deepEqual(lone.modelSuggestions,[]);
 const duplicate=localVisionResult([bound,bound],products,coverage,'/customer',0.55,query);
 assert.deepEqual(duplicate.modelSuggestions,[]);
 const second={...bound,score:0.56,row:{...bound.row,id:'second-photo',url:'/storage/second-photo.webp'}};
 const supported=localVisionResult([bound,second],products,coverage,'/customer',0.55,query);
 assert.equal(supported.catalogImageMatches!.length,2);assert.equal(supported.modelSuggestions!.length,2);
 assert.equal(supported.catalogImageMatches![0].score,57);assert.deepEqual(supported.matchedProducts,[]);
 const inactive=localVisionResult([bound,second],products.map(p=>({...p,active:false})),coverage,'/customer',0.55,query);
 assert.deepEqual(inactive.modelSuggestions,[]);
 const strong=localVisionResult([{...bound,score:0.8}],products,coverage,'/customer',0.55,query);
 assert.equal(strong.catalogImageMatches!.length,1);
});
test('weak nearest neighbours are never returned as product suggestions, even when the legacy flag is set',()=>{
 const low=hit([{familyCode:'family',verified:false}],0.31);
 const result=localVisionResult([low],products,coverage,'/customer',0.65,undefined,true);
 assert.deepEqual(result.catalogImageMatches,[]);assert.deepEqual(result.matchedProducts,[]);assert.deepEqual(result.similarCandidates,[]);
 assert.equal(result.nearestCatalogSuggestions,undefined);
});
test('unlinked catalogue photographs are not shown as products even with a high visual score',()=>{
 const result=localVisionResult([hit([],0.99)],products,coverage,'/customer');
 assert.deepEqual(result.catalogImageMatches,[]);
 assert.deepEqual(result.modelSuggestions,[]);
 assert.deepEqual(result.similarCandidates,[]);
 assert.equal(result.summary.catalogAvailability!.status,'custom_order_available');
});
test('a bound family without any SKU appears as a visual family result without an invented code',()=>{
 const noSku=[{code:'no-sku-family',name:'خانواده بدون کد',active:true,images:['family.webp'],variants:[]}] as Product[];
 const result=localVisionResult([hit([{familyCode:'no-sku-family',verified:false}],0.91)],noSku,coverage,'/customer');
 assert.equal(result.modelSuggestions!.length,1);
 assert.equal(result.modelSuggestions![0].recordType,'family');
 assert.equal(result.modelSuggestions![0].code,undefined);
 assert.equal(result.modelSuggestions![0].familyCode,'no-sku-family');
 assert.equal(result.modelSuggestions![0].visualScore,91);
});
