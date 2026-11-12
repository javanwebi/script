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
test('a family-bound photo is scored at family level when no SKU-specific binding identifies its model',()=>{
 const uncoded=[{...products[0],code:'uncoded',name:'قطعه بدون کد',variants:[{code:'uncoded-0',name:'مدل دارای کد',active:true}]}] as Product[];
 const result=localVisionResult([hit([{familyCode:'uncoded',verified:false}],0.94)],uncoded,coverage,'/customer');
 assert.ok(result.modelSuggestions!.length>=1);
 assert.equal(result.modelSuggestions![0].familyCode,'uncoded');
 assert.equal(result.modelSuggestions![0].code,undefined);
 assert.equal(result.modelSuggestions![0].matchBasis,'visual');
 assert.equal(result.modelSuggestions![0].visualScore,94);
 assert.equal(result.catalogImageMatches![0].bindings.length,1);
 assert.equal(result.catalogImageMatches![0].bindings[0].code,undefined);
 assert.deepEqual(result.similarCandidates,[]);
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
  res.end(JSON.stringify(req.url==='/query'?{model:LOCAL_VISION_MODEL,pipeline:LOCAL_VISION_PIPELINE,vectors:[Array(384).fill(0.1)],viewRegions:[null],region:broken?{x:-1,y:0,width:1,height:1}:null,markings:[{text:'6203ZZ',confidence:96}],ocrAvailable:true}:{model:LOCAL_VISION_MODEL,pipeline:LOCAL_VISION_PIPELINE,evidence:[{supported:true,inliers:20,coverage:0.3}]}));
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
 assert.equal(supported.catalogImageMatches!.length,2);assert.equal(supported.modelSuggestions!.length,3);
 assert.equal(supported.modelSuggestions![0].code,undefined);assert.equal(supported.modelSuggestions![0].matchBasis,'visual');
 assert.deepEqual(supported.modelSuggestions!.slice(1).map(item=>item.code),['other-size','sku']);
 assert.equal(supported.catalogImageMatches![0].score,57);assert.deepEqual(supported.matchedProducts,[]);
 const inactive=localVisionResult([bound,second],products.map(p=>({...p,active:false})),coverage,'/customer',0.55,query);
 assert.deepEqual(inactive.modelSuggestions,[]);
 const strong=localVisionResult([{...bound,score:0.8}],products,coverage,'/customer',0.55,query);
 assert.equal(strong.catalogImageMatches!.length,1);
});
test('opt-in nearest catalogue suggestions are unconfirmed, bounded and separate from accepted matches',()=>{
 const low=hit([{familyCode:'family',verified:false}],0.31);
 const result=localVisionResult([low],products,coverage,'/customer',0.65,undefined,true);
 assert.deepEqual(result.catalogImageMatches,[]);assert.deepEqual(result.matchedProducts,[]);assert.deepEqual(result.similarCandidates,[]);
 assert.equal(result.nearestCatalogSuggestions!.length,3);
 assert.ok(result.nearestCatalogSuggestions!.some(m=>m.code===undefined&&m.familyCode==='family'));
 assert.ok(result.nearestCatalogSuggestions!.every(m=>m.matchBasis==='explore'&&m.visualScore===undefined&&m.code!=='inactive'));
 const strong=localVisionResult([hit([{familyCode:'family',verified:false}],0.9)],products,coverage,'/customer',0.65,undefined,true);
 assert.equal(strong.nearestCatalogSuggestions,undefined);
});

test('the retained DINOv2 profile supports a full frame plus three independent region proposals',async()=>{
 const {localVisionProfile}=await import('../src/services/localVision');
 assert.equal(localVisionProfile({}).maxViews,4);
});

test('high-scoring unbound photos are not exposed as catalogue products',()=>{
 const result=localVisionResult([hit([],0.98)],products,coverage,'/customer');
 assert.deepEqual(result.catalogImageMatches,[]);
 assert.deepEqual(result.similarCandidates,[]);
 assert.deepEqual(result.modelSuggestions,[]);
});

test('automatic crop defaults to the highest-scoring detected object, not the uncropped full frame',async()=>{
 const {selectBestQueryRegion}=await import('../src/services/localVision');
 const first={x:0.1,y:0.2,width:0.2,height:0.3};
 const second={x:0.62,y:0.3,width:0.25,height:0.35};
 assert.deepEqual(selectBestQueryRegion([null,first,second],[0.99,0.72,0.91],first),second);
 assert.deepEqual(selectBestQueryRegion([null,first,second],[0.99,Number.NaN,Number.NaN],first),first);
 assert.equal(selectBestQueryRegion([null],[0.99]),undefined);
});

test('automatic crop scores come from the best real catalogue-bound photo, never an unbound nearest image',async()=>{
 const {bestBoundQueryViewScores}=await import('../src/services/localVision');
 const unbound={...hit([],0.99),viewScores:[0.99,0.12]};
 const bound={...hit([{familyCode:'family',verified:false}],0.91),viewScores:[0.72,0.88]};
 assert.deepEqual(bestBoundQueryViewScores([unbound,bound],products),[0.72,0.88]);
 assert.deepEqual(bestBoundQueryViewScores([unbound],products),[]);
});

test('legacy DINO worker supports a full frame and one crop without inventing multi-region coordinates',async()=>{
 const {describeLocalQuery,LOCAL_VISION_PIPELINE}=await import('../src/services/localVision');
 const region={x:0.2,y:0.1,width:0.4,height:0.5};
 let count=2,box:typeof region|null=region;
 const server=http.createServer(async(req,res)=>{
  for await(const _chunk of req){}
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify({model:LOCAL_VISION_MODEL,pipeline:LOCAL_VISION_PIPELINE,vectors:Array.from({length:count},()=>Array(384).fill(0.1)),region:box,markings:[],ocrAvailable:false}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const env={LOCAL_VISION_URL:`http://127.0.0.1:${(server.address() as any).port}`,LOCAL_VISION_TOKEN:'test-token'};
  assert.deepEqual((await describeLocalQuery(Buffer.from('photo'),env)).viewRegions,[null,region]);
  count=1;box=null;
  assert.deepEqual((await describeLocalQuery(Buffer.from('photo'),env)).viewRegions,[null]);
  count=2;
  await assert.rejects(()=>describeLocalQuery(Buffer.from('photo'),env),/Missing query regions/);
  count=3;box=region;
  await assert.rejects(()=>describeLocalQuery(Buffer.from('photo'),env),/Missing query regions/);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
