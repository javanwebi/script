/**
 * Server-only, opt-in publication queue for product photo uploads.
 * No GitHub credentials may be shipped to browser code. This is intentionally
 * disabled until the owner approves the schema and production configuration.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {databaseEnabled,transaction} from './db/connection';
import {productStorageDirectory} from './productImageStorage';

const repo='javanwebi/script';
const intervalMs=10*60*1000;
type Job={
 id:string;upload_id:string;gallery_id:string;family_code:string;
 variant_code:string|null;original_extension:string;original_sha256:string;
 old_url:string;public_original_url:string;public_thumb_url:string;
 public_medium_url:string;state:string;attempts:number;
 pr_number:number|null;git_commit_sha:string|null;
};
const enabled=()=>databaseEnabled()&&process.env.PRODUCT_GITHUB_PUBLISH_ENABLED==='1'&&
  Boolean(process.env.GITHUB_MEDIA_TOKEN);

async function gh(method:string,endpoint:string,body?:unknown):Promise<any>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),30000);
 try{
  const reply=await fetch('https://api.github.com/repos/'+repo+endpoint,{
   method,signal:controller.signal,
   headers:{
    'Authorization':'Bearer '+process.env.GITHUB_MEDIA_TOKEN,
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'sanatpish-catalog-image-publisher',
    ...(body===undefined?{}:{'Content-Type':'application/json'})
   },
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!reply.ok)throw new Error('github_http_'+reply.status);
  return reply.json();
 }finally{clearTimeout(timeout);}
}
function publicationFiles(job:Job){
 const id=job.upload_id,ext=job.original_extension;
 if(!/^[a-f0-9-]{36}$/i.test(id) || !['jpg','png','webp'].includes(ext) ||
    !/^[a-f0-9]{64}$/.test(job.original_sha256))throw Error('invalid_media_metadata');
 const hash=job.original_sha256.slice(0,12);
 const urls=[
   '/products/uploads/'+id+'.'+ext,
   '/products/uploads/optimized/'+id+'.'+hash+'.w320.webp',
   '/products/uploads/optimized/'+id+'.'+hash+'.w960.webp'
 ];
 if([job.public_original_url,job.public_thumb_url,job.public_medium_url].some((v,i)=>v!==urls[i]))
  throw Error('media_path_mismatch');
 const dir=path.join(productStorageDirectory(),'publish-queue');
 return urls.map((url,i)=>({
  relative:'public'+url,
  absolute:path.join(dir,i===0?id+'.'+ext:id+'.'+hash+(i===1?'.w320.webp':'.w960.webp')),
  original:i===0
 }));
}
async function claimBatch():Promise<Job[]>{
 return transaction(async client=>{
  // Workers are safe across replicas, and interrupted work eventually retries.
  await client.query("update public.catalog_image_publications set state='retry',retry_after=now()+interval '5 minutes',updated_at=now() where state='publishing' and updated_at<now()-interval '45 minutes' and attempts<8");
  const rows=(await client.query(
   "select * from public.catalog_image_publications where state in ('pending','retry') and attempts<8 and (retry_after is null or retry_after<=now()) order by created_at for update skip locked limit 6"
  )).rows as Job[];
  for(const row of rows)await client.query(
   "update public.catalog_image_publications set state='publishing',attempts=attempts+1,updated_at=now() where id=$1",
   [row.id]
  );
  return rows;
 });
}
async function publishBatch(rows:Job[]){
 const ref=await gh('GET','/git/ref/heads/main');
 const parent=String(ref.object?.sha||'');
 if(!/^[a-f0-9]{40}$/.test(parent))throw Error('invalid_github_main_ref');
 const base=await gh('GET','/git/commits/'+parent);
 const tree:any[]=[];
 for(const row of rows){
  for(const file of publicationFiles(row)){
   const bytes=await fs.readFile(file.absolute);
   if(!bytes.length||bytes.length>12*1024*1024)throw Error('media_bytes_invalid');
   if(file.original && crypto.createHash('sha256').update(bytes).digest('hex')!==row.original_sha256)
    throw Error('media_original_hash_mismatch');
   const blob=await gh('POST','/git/blobs',{content:bytes.toString('base64'),encoding:'base64'});
   tree.push({path:file.relative,mode:'100644',type:'blob',sha:blob.sha});
  }
 }
 const nextTree=await gh('POST','/git/trees',{base_tree:base.tree.sha,tree});
 const commit=await gh('POST','/git/commits',{
  message:'assets: publish '+rows.length+' approved admin product image(s)',
  tree:nextTree.sha,parents:[parent]
 });
 const branch='media-'+rows[0].upload_id.slice(0,8)+'-'+Date.now().toString(36);
 await gh('POST','/git/refs',{ref:'refs/heads/'+branch,sha:commit.sha});
 const pr=await gh('POST','/pulls',{
  head:branch,base:'main',title:'Publish '+rows.length+' new product images',
  body:'Automated authenticated batch. Original product images stay on the durable Volume until CI and deployment succeed.'
 });
 await transaction(async client=>{
  for(const row of rows)await client.query(
   "update public.catalog_image_publications set state='awaiting_ci',pr_number=$2,git_commit_sha=$3,last_error=null,updated_at=now() where id=$1 and state='publishing'",
   [row.id,pr.number,commit.sha]
  );
 });
}
async function processQueued(){
 const batch=await claimBatch();
 if(!batch.length)return;
 try{await publishBatch(batch);}
 catch(error){
  const message=String((error as Error)?.message||'github_unavailable').slice(0,120);
  console.warn('[Catalog publisher] Retry:',message);
  await transaction(async client=>{
   for(const row of batch)await client.query(
    "update public.catalog_image_publications set state=case when attempts>=8 then 'blocked' else 'retry' end,retry_after=now()+interval '20 minutes',last_error=$2,updated_at=now() where id=$1 and state='publishing'",
    [row.id,message]
   );
  });
 }
}
async function reviewPublications(){
 const all=(await transaction(async client=>(await client.query(
  "select * from public.catalog_image_publications where state='awaiting_ci' and pr_number is not null order by created_at limit 60"
 )).rows)) as Job[];
 const byPr=new Map<number,Job[]>();
 for(const job of all)if(job.pr_number)byPr.set(job.pr_number,[...(byPr.get(job.pr_number)||[]),job]);
 for(const [prNum,jobs] of byPr){
  try{
   const pr=await gh('GET','/pulls/'+prNum);
   if(pr.merged){
    await transaction(async client=>client.query(
     "update public.catalog_image_publications set state='awaiting_deploy',updated_at=now() where pr_number=$1 and state='awaiting_ci'",[prNum]));
    continue;
   }
   if(pr.state!=='open')continue;
   const data=await gh('GET','/commits/'+jobs[0].git_commit_sha+'/check-runs?per_page=100');
   const checks=Array.isArray(data.check_runs)?data.check_runs:[];
   if(!checks.some((x:any)=>x.name==='database-and-frontend')||
      !checks.some((x:any)=>x.name==='test-and-build'))continue;
   if(checks.some((x:any)=>x.status==='completed'&&x.conclusion!=='success')){
    await transaction(async client=>client.query(
     "update public.catalog_image_publications set state='blocked',last_error='github_ci_failed',updated_at=now() where pr_number=$1 and state='awaiting_ci'",[prNum]));
    continue;
   }
   if(checks.some((x:any)=>x.status!=='completed'))continue;
   await gh('PUT','/pulls/'+prNum+'/merge',{sha:jobs[0].git_commit_sha,merge_method:'squash'});
   await transaction(async client=>client.query(
    "update public.catalog_image_publications set state='awaiting_deploy',updated_at=now() where pr_number=$1 and state='awaiting_ci'",[prNum]));
  }catch(e){console.warn('[Catalog publisher] CI merge deferred:',String((e as Error)?.message).slice(0,70));}
 }
}
async function verifiedLive(job:Job):Promise<boolean>{
 const origin=process.env.PUBLIC_APP_URL || process.env.APP_URL;
 if(!origin || !origin.startsWith('https://'))return false;
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),15000);
 try{
  for(const url of [job.public_original_url,job.public_thumb_url,job.public_medium_url]){
   const reply=await fetch(origin.replace(/\/$/,'')+url,{
    method:url===job.public_original_url?'GET':'HEAD',
    signal:abort.signal,redirect:'manual',headers:{'Cache-Control':'no-cache'}
   });
   if(reply.status!==200)return false;
   if(url===job.public_original_url){
    const bytes=Buffer.from(await reply.arrayBuffer());
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==job.original_sha256)return false;
   }
  }
  return true;
 }catch{return false;}
 finally{clearTimeout(timeout);}
}
async function finalizePublished(onCatalogUpdated:()=>Promise<void>){
 const jobs=(await transaction(async client=>(await client.query(
  "select * from public.catalog_image_publications where state='awaiting_deploy' order by created_at limit 12"
 )).rows)) as Job[];
 let changed=false;
 for(const job of jobs){
  if(!await verifiedLive(job))continue;
  await transaction(async client=>{
   const found=(await client.query('select url from public.catalog_gallery_images where id=$1 for update',[job.gallery_id])).rows[0];
   if(!found || (found.url!==job.old_url && found.url!==job.public_medium_url)){
    await client.query("update public.catalog_image_publications set state='blocked',last_error='gallery_url_changed',updated_at=now() where id=$1",[job.id]);
    return;
   }
   if(found.url===job.old_url){
    await client.query("update public.catalog_gallery_images set url=$2,file_name=$3,updated_at=now() where id=$1",
      [job.gallery_id,job.public_medium_url,path.basename(job.public_medium_url)]);
    const fam=(await client.query('select images from public.catalog_families where code=$1 for update',[job.family_code])).rows[0];
    if(fam)await client.query("update public.catalog_families set images=replace(images::text,$2,$3)::jsonb,updated_at=now() where code=$1",
      [job.family_code,job.old_url,job.public_medium_url]);
    if(job.variant_code){
     const variant=(await client.query('select images from public.catalog_variants where code=$1 for update',[job.variant_code])).rows[0];
     if(variant)await client.query("update public.catalog_variants set images=replace(images::text,$2,$3)::jsonb,updated_at=now() where code=$1",
      [job.variant_code,job.old_url,job.public_medium_url]);
    }
    await client.query("update public.portal_kv_store set value=replace(value::text,$1,$2)::jsonb where key='catalog_overrides_db_v1' and value::text like '%'||$1||'%'",
      [job.old_url,job.public_medium_url]);
    changed=true;
   }
   await client.query("update public.catalog_image_publications set state='published',published_at=now(),last_error=null,updated_at=now() where id=$1",[job.id]);
  });
 }
 if(changed)await onCatalogUpdated();
}
let busy=false;
export function startCatalogGithubPublisher(onCatalogUpdated:()=>Promise<void>){
 if(!enabled())return;
 const tick=async()=>{
  if(busy)return;busy=true;
  try{await reviewPublications();await finalizePublished(onCatalogUpdated);await processQueued();}
  catch(error){console.warn('[Catalog publisher] Deferred:',String((error as Error)?.message||error).slice(0,110));}
  finally{busy=false;}
 };
 void tick();
 setInterval(()=>void tick(),intervalMs).unref();
 console.log('[Catalog publisher] Authenticated 10-minute publication batches enabled');
}
