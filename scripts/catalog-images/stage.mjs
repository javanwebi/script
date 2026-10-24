#!/usr/bin/env node
/**
 * Staging-only importer for immutable official product photos.
 * Does not connect to, write to, or rewrite the production database.
 * Node 22+, sharp installed by npm ci; source checkout supplied by CI.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const mode=process.argv[2] || 'stage';
const source=path.resolve(process.env.CATALOG_SOURCE_DIR || '.catalog-source');
const output=path.resolve('public/products/catalog');
const checks=JSON.parse(await fs.readFile('scripts/catalog-images/official-source-checksums.json','utf8'));
const expected=checks.records;
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const blobSha=data=>crypto.createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
const sourceRoot='/storage/products/catalog/';
const liveBase=process.env.BASELINE_VOLUME_URL || 'https://sanatpish-production.up.railway.app';
const manifestFile=path.join(output,'manifest.json');
const reportDir=path.resolve('reports/catalog-images');
const MB=1024*1024;
if(expected.length!==869 || new Set(expected.map(x=>x.file)).size!==869)throw new Error('Invalid official image manifest: expected 869 unique paths');

async function pool(items,limit,fn){
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(cursor<items.length){const index=cursor++;await fn(items[index],index);}
 }));
}
async function verifyOriginals(folder){
 let bytes=0;const failures=[];
 await pool(expected,8,async entry=>{
  const full=path.join(folder,entry.file);
  try{
   const data=await fs.readFile(full);
   if(data.length!==entry.bytes || digest(data)!==entry.sha256 || blobSha(data)!==entry.gitBlob)
    throw new Error('size/hash mismatch');
   bytes+=data.length;
  }catch(error){failures.push(entry.file+': '+String(error.message||error));}
 });
 if(failures.length)throw new Error('Unverified source images: '+failures.slice(0,12).join(', '));
 return bytes;
}
async function inspectLiveVolume(){
 if(process.env.SKIP_VOLUME_VERIFICATION==='1')
   throw new Error('Skipping live-volume comparison is not allowed in the production-source staging job');
 const measures=[],errors=[];
 await pool(expected,6,async entry=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  const begin=performance.now();
  try{
   const url=liveBase+sourceRoot+encodeURIComponent(entry.file);
   const response=await fetch(url,{signal:controller.signal,redirect:'manual',headers:{'accept':'image/png'}});
   if(response.status!==200)throw new Error('HTTP '+response.status+' (redirects disallowed)');
   if(!String(response.headers.get('content-type')||'').includes('image/png'))throw new Error('unexpected media type');
   const data=Buffer.from(await response.arrayBuffer());
   if(digest(data)!==entry.sha256)throw new Error('SHA-256 differs from authoritative PostgreSQL audit');
   measures.push({file:entry.file,ms:Math.round(performance.now()-begin),bytes:data.length});
  }catch(error){errors.push(entry.file+': '+String(error.message||error));}
  finally{clearTimeout(timeout);}
 });
 await fs.mkdir(reportDir,{recursive:true});
 measures.sort((a,b)=>a.ms-b.ms);
 const metrics={tested:measures.length,failed:errors.length,source:liveBase+sourceRoot,
   bytes:measures.reduce((n,x)=>n+x.bytes,0),
   latencyMs:{median:measures[Math.floor(measures.length*.5)]?.ms||0,p95:measures[Math.floor(measures.length*.95)]?.ms||0,max:measures.at(-1)?.ms||0}};
 await fs.writeFile(path.join(reportDir,'volume-baseline.json'),JSON.stringify({metrics,errors},null,2)+'\n');
 if(errors.length)throw new Error('Volume snapshot does not match pinned GitHub originals: '+errors.slice(0,12).join('; '));
 return metrics;
}
async function stage(){
 if(!checks.sourceCommit||!checks.supabaseProject)throw new Error('Missing provenance');
 const inputBytes=await verifyOriginals(source);
 const live=await inspectLiveVolume();
 await fs.mkdir(output,{recursive:true});
 const optimizedDir=path.join(output,'optimized');await fs.mkdir(optimizedDir,{recursive:true});
 let earlier;try{earlier=JSON.parse(await fs.readFile(manifestFile,'utf8'))}catch{earlier={records:{}}}
 let thumbBytes=0,mediumBytes=0,processed=0,skipped=0;
 const manifest={format:1,sourceRepo:checks.sourceRepo,sourceCommit:checks.sourceCommit,
   inputBytes,records:{}};
 const issues=[];
 await pool(expected,2,async (entry,index)=>{
  const name=entry.file;const base=name.slice(0,-4),hash=entry.sha256.slice(0,12);
  const thumbName=base+'.'+hash+'.w320.webp',mediumName=base+'.'+hash+'.w960.webp';
  const tPath=path.join(optimizedDir,thumbName),mPath=path.join(optimizedDir,mediumName);
  const originalFile=path.join(output,name);
  const inputFile=path.join(source,name);
  try{
   if(!(await fs.stat(originalFile).then(x=>x.size===entry.bytes).catch(()=>false)) ||
      digest(await fs.readFile(originalFile))!==entry.sha256)
    await fs.copyFile(inputFile,originalFile);
   const unchanged=await Promise.all([tPath,mPath].map(p=>fs.stat(p).then(x=>x.size>0).catch(()=>false)));
   if(unchanged.every(Boolean)) skipped++;
   else{
    for(const [width,target,quality] of [[320,tPath,80],[960,mPath,84]]){
     await sharp(inputFile,{limitInputPixels:30000000}).rotate()
       .resize({width,height:width,fit:'inside',withoutEnlargement:true})
       .webp({quality,effort:4}).toFile(target+'.tmp');
     await fs.rename(target+'.tmp',target);
    }
    processed++;
   }
   const [thumbSize,mediumSize]=await Promise.all([fs.stat(tPath),fs.stat(mPath)]);
   thumbBytes+=thumbSize.size;mediumBytes+=mediumSize.size;
   manifest.records[name]={sha256:entry.sha256,bytes:entry.bytes,
     original:'/products/catalog/'+name,
     thumb:'/products/catalog/optimized/'+thumbName,
     medium:'/products/catalog/optimized/'+mediumName,
     thumbBytes:thumbSize.size,mediumBytes:mediumSize.size};
  }catch(error){issues.push(name+': '+String(error.message||error));}
  if((index+1)%100===0)console.log('Prepared',index+1,'of',expected.length,'official product photos');
 });
 if(issues.length)throw new Error(issues.slice(0,12).join('; '));
 if(Object.keys(manifest.records).length!==869)throw new Error('Incomplete generated manifest');
 await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
 const compact=Object.fromEntries(Object.entries(manifest.records).map(([file,value])=>[file,{thumb:value.thumb,medium:value.medium}]));
 await fs.mkdir('src/generated',{recursive:true});
 await fs.writeFile('src/generated/catalogImageAssets.ts',
  '/* Generated from verified official product PNGs; DO NOT edit by hand. */\n'+
  'export const catalogImageAssets:Record<string,{thumb:string;medium:string}> = '+
  JSON.stringify(compact)+';\n');
 const summary={originalCount:expected.length,rawBytes:inputBytes,thumbBytes,mediumBytes,
   generated:processed,unchanged:skipped,liveVolume:live,
   exactHashMatches:expected.length,duplicateSha256:expected.length-new Set(expected.map(x=>x.sha256)).size};
 await fs.writeFile(path.join(reportDir,'staging-summary.json'),JSON.stringify(summary,null,2)+'\n');
 console.log('Catalog source-staging summary:',JSON.stringify(summary));
}
async function verify(){
 const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
 if(Object.keys(manifest.records||{}).length!==869)throw new Error('Missing photos in optimized manifest');
 await verifyOriginals(output);
 await pool(expected,6,async entry=>{
  const record=manifest.records[entry.file];
  if(record.sha256!==entry.sha256)throw new Error('Manifest hash mismatch for '+entry.file);
  for(const variant of [record.thumb,record.medium]){
   const file=path.resolve('public'+variant);
   if(!file.startsWith(output+path.sep)||!(await fs.stat(file).then(x=>x.size>0).catch(()=>false)))
    throw new Error('Missing optimized variant '+variant);
  }
 });
 console.log('Verified all 869 original PNGs and 1738 optimized WebP files.');
}
if(mode==='stage')await stage();
else if(mode==='verify')await verify();
else throw new Error('Expected stage or verify');
