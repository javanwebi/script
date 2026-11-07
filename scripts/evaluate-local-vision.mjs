// Usage: node scripts/evaluate-local-vision.mjs https://staging.example /private/photos.json
// Manifest: [{id:'bearing-1',file:'/private/photo.jpg',expectedFamily:'real-family-code'}]
// Use expectedCode for dedicated SKU photos, or outOfCatalog:true for negatives.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const [origin,manifestFile]=process.argv.slice(2);
if(!origin || !manifestFile)throw new Error('Provide staging origin and a labelled photo manifest');
const base=new URL(origin);
if(base.protocol!=='https:' && !['localhost','127.0.0.1'].includes(base.hostname))throw new Error('Use HTTPS or local staging');
const rows=JSON.parse(await readFile(manifestFile,'utf8'));
if(!Array.isArray(rows)||!rows.length)throw new Error('Empty manifest');
const status=await fetch(new URL('/api/ai/local-vision-status',base)).then(r=>r.json());
if(!status.enabled || !status.ready)throw new Error('Local index is disabled or not ready');
const results=[];
for(const row of rows){
 if(!row.file || !(row.expectedFamily || row.expectedCode || row.outOfCatalog===true))throw new Error('Each photo needs expectedFamily, expectedCode, or outOfCatalog');
 const started=performance.now();
 try{
  const bytes=await readFile(path.resolve(path.dirname(manifestFile),row.file));
  const ext=path.extname(row.file).toLowerCase();
  const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[ext];
  if(!mime)throw new Error('Unsupported photo format');
  const upload=await fetch(new URL('/api/ai/customer-images',base),{method:'POST',headers:{'Content-Type':mime},body:bytes});
  if(!upload.ok)throw new Error(`Upload HTTP ${upload.status}`);
  const {imageUrl}=await upload.json();
  const response=await fetch(new URL('/api/ai/analyze-part',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageUrl,stage:'quick',region:row.region})});
  if(!response.ok)throw new Error(`Search HTTP ${response.status}`);
  const data=await response.json();
  if(data.retrieval?.mode!=='local-embedding')throw new Error('Unexpected non-local response');
  const photos=data.catalogImageMatches || [];
  const top5Families=[...new Set(photos.flatMap(p=>p.bindings.map(b=>b.familyCode)))].slice(0,5);
  const top5Codes=[...new Set(photos.flatMap(p=>p.bindings.flatMap(b=>b.code?[b.code]:[])))].slice(0,5);
  results.push({id:row.id || results.length+1,ms:Math.round(performance.now()-started),
   familyHit:row.expectedFamily?top5Families.includes(row.expectedFamily):undefined,
   codeHit:row.expectedCode?top5Codes.includes(row.expectedCode):undefined,
   negativeCorrect:row.outOfCatalog===true?photos.length===0:undefined,
   unexpectedExact:!!data.matchedProducts?.length});
 }catch(error){results.push({id:row.id || results.length+1,error:error.message});}
}
const rate=key=>{const cases=results.filter(r=>typeof r[key]==='boolean');return cases.length?cases.filter(r=>r[key]).length/cases.length:null;};
const times=results.filter(r=>Number.isFinite(r.ms)).map(r=>r.ms).sort((a,b)=>a-b);
console.log(JSON.stringify({model:status.model,total:rows.length,errors:results.filter(r=>r.error).length,
 familyRecallAt5:rate('familyHit'),boundCodeRecallAt5:rate('codeHit'),negativeRejectionRate:rate('negativeCorrect'),
 p95EndToEndMs:times.length?times[Math.ceil(times.length*0.95)-1]:null,
 unexpectedExactClaims:results.filter(r=>r.unexpectedExact).length,results},null,2));
if(results.some(r=>r.error))process.exitCode=1;
