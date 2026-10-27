import assert from 'node:assert/strict';
import sharp from 'sharp';

/**
 * Non-destructive, remote API smoke test against production.
 * Only creates temporary customer-image uploads/jobs; NEVER edits catalogue,
 * SKU records, images, inventory, prices, accounts or database schemas.
 * Deliberately kept on an isolated test branch; do not run on every main push.
 */
const ORIGIN=process.env.VISION_SMOKE_ORIGIN || 'https://sanatpish-production.up.railway.app';
if(ORIGIN!=='https://sanatpish-production.up.railway.app')
  throw new Error('Smoke test may only run against the approved Railway production origin');
const failures=[];
const results=[];
const timeout=ms=>AbortSignal.timeout(ms);
async function request(path,opts={},ms=18000) {
 const start=Date.now();
 const res=await fetch(ORIGIN+path,{redirect:'error',...opts,signal:timeout(ms)});
 const buf=Buffer.from(await res.arrayBuffer());
 const type=res.headers.get('content-type') || '';
 let json;
 if(type.includes('json'))try{json=JSON.parse(buf.toString('utf8'));}catch{}
 return {res,json,buf,ms:Date.now()-start};
}
function record(name,pass,info={}) {
 results.push({name,pass,...info});
 console.log(JSON.stringify({test:name,result:pass?'PASS':'FAIL',...info}));
 if(!pass)failures.push(name);
}
function countStatus(jobs,kind){return jobs.filter(v=>v?.status===kind).length}
async function imageUpload(bytes){
 const {res,json}=await request('/api/ai/customer-images',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:bytes},25000);
 assert.equal(res.status,201,'customer image upload should return 201: '+JSON.stringify(json));
 assert.ok(/^https:\/\//.test(json?.imageUrl),'uploaded file should have an https imageUrl');
 return json.imageUrl;
}
async function submit(imageUrl,measurements) {
 const {res,json}=await request('/api/ai/analyze-part',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageUrl,stage:measurements?'refined':'quick',measurements})},25000);
 assert.equal(res.status,202,'analyze-part should accept request: '+JSON.stringify(json));
 assert.ok(/^[0-9a-f-]{36}$/i.test(json?.jobId),'valid job id returned');
 return json.jobId;
}
async function waitJobs(ids,maxMs=150000){
 const deadline=Date.now()+maxMs;
 const out=new Map();
 while(out.size<ids.length && Date.now()<deadline){
  await Promise.all(ids.filter(id=>!out.has(id)).map(async id=>{
   const {res,json}=await request('/api/ai/recognition-jobs/'+id,{},13000);
   if(res.status!==200)throw new Error('Job polling returned HTTP '+res.status+' for '+id);
   if(json.status==='complete'||json.status==='failed')out.set(id,json);
  }));
  if(out.size<ids.length)await new Promise(resolve=>setTimeout(resolve,1200));
 }
 return ids.map(id=>out.get(id));
}
try {
 const health=await request('/api/health');
 record('Production health HTTP 200',health.res.status===200,{http:health.res.status,ms:health.ms,health:health.json?.status});
 const index=await request('/api/ai/visual-index-status');
 record('Local image index truly covers 869+ real photos',index.res.status===200 && index.json?.mode==='offline-local' && index.json?.ready && index.json?.indexed>=869,{http:index.res.status,coverage:index.json});
 let photo, photoId;
 for(let i=1;i<=20;i++){
  const id='e('+i+').png';
  const r=await request('/api/ai/catalog-images/'+encodeURIComponent(id),{},20000);
  if(r.res.ok && (r.res.headers.get('content-type')||'').startsWith('image/') && r.buf.length>1000){
   photo=r.buf;photoId=id;break;
  }
 }
 record('Download unchanged catalogue image from real storage',!!photo,{imageId:photoId,bytes:photo?.length});
 if(photo){
  const img=await sharp(photo).jpeg({quality:92}).toBuffer();
  const uploaded=await imageUpload(img);
  const job=await submit(uploaded);
  const [first]=await waitJobs([job],80000);
  record('Real browser-independent upload -> job -> result API',first?.status==='complete' && first?.result?.success===true,{status:first?.status,error:first?.error});
  if(first?.status==='complete'){
   const matches=first.result.catalogImageMatches||[];
   record('Original catalogue image appears in real retrieval top 12',matches.some(x=>x.imageId===photoId),{imageId:photoId,topImages:matches.slice(0,5).map(x=>x.imageId)});
   record('No invented SKU identity claims',Array.isArray(first.result.matchedProducts)&&first.result.matchedProducts.every(x=>x.identityEvidence!=='similarity-only'),{exactCount:first.result.matchedProducts.length,similarCount:first.result.similarCandidates?.length||0});
  }
  const rotated=await sharp(photo).rotate(90).jpeg({quality:90}).toBuffer();
  const rotatedUrl=await imageUpload(rotated);
  const rotatedJob=await submit(rotatedUrl);
  const [rotatedResult]=await waitJobs([rotatedJob],80000);
  const rotatedMatches=rotatedResult?.result?.catalogImageMatches||[];
  record('Planar 90-degree rotation returns catalogue image candidate',rotatedResult?.status==='complete'&&rotatedMatches.some(x=>x.imageId===photoId),{top:rotatedMatches.slice(0,6).map(x=>x.imageId)});
  const strange=await sharp({create:{width:224,height:224,channels:3,background:'#fff'}})
    .composite([{input:Buffer.from('<svg width="224" height="224"><path d="M112 10 L220 205 L5 205 Z" fill="#111"/></svg>')}]).jpeg({quality:93}).toBuffer();
  const newUrl=await imageUpload(strange);
  const newJob=await submit(newUrl);
  const [negative]=await waitJobs([newJob],80000);
  record('Out-of-catalog negative input never asserts exact SKU',negative?.status==='complete'&&(negative.result.matchedProducts||[]).length===0,{status:negative?.status,exact:negative?.result?.matchedProducts?.length,error:negative?.error});
  // A burst of 10 different job IDs is deliberately capped by the app's
  // one-heavy-worker concurrency setting, avoiding 10 concurrent CPU scans.
  const ids=await Promise.all(Array.from({length:10},()=>submit(uploaded)));
  record('Ten concurrent HTTP submissions accepted safely',new Set(ids).size===10,{jobs:ids.length});
  const ten=await waitJobs(ids,150000);
  record('Ten queued jobs finish and return valid catalogue results',ten.every(v=>v?.status==='complete'&&v?.result?.success===true),{complete:countStatus(ten,'complete'),failed:countStatus(ten,'failed'),missing:ten.filter(v=>!v).length});
 }
 const finalHealth=await request('/api/health');
 record('Production remains healthy after photo load test',finalHealth.res.status===200,{http:finalHealth.res.status,ms:finalHealth.ms});
} catch(error) {
 console.error('LIVE_SMOKE_EXCEPTION',String(error?.stack||error));
 failures.push('Unexpected integration error: '+String(error?.message||error));
}
console.log('SMOKE_SUMMARY',JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,failures}));
if(failures.length)process.exitCode=1;
