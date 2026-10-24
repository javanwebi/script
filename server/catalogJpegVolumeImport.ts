/**
 * Import the 725 JPEG variants in javanweb/IMAGE to the persistent product volume.
 * Preserve the old 869 PNG assets. The database URL switch only happens after
 * every new file has been checked against its pinned Git blob SHA.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {databaseEnabled,transaction} from './db/connection';
import {warmProductThumbs} from './productImageVariants';

export const IMAGE_JPEG_REPOSITORY='javanweb/IMAGE';
const REPO=IMAGE_JPEG_REPOSITORY;
export const IMAGE_JPEG_PINNED_COMMIT='5e8fadaef9f16d0ed03dae3462b60cae4c2a50e6';
const REVISION=IMAGE_JPEG_PINNED_COMMIT;
export const IMAGE_JPEG_COUNT=725;
const EXPECTED=IMAGE_JPEG_COUNT;
const MIN_FREE=25*1024*1024;
type FileEntry={name:string;repoPath:string;size:number;sha:string};

const gitHash=(bytes:Buffer)=>crypto.createHash('sha1')
  .update('blob '+bytes.length+'\0').update(bytes).digest('hex');

async function sourceManifest():Promise<FileEntry[]>{
 const url='https://api.github.com/repos/'+REPO+'/git/trees/'+REVISION+'?recursive=1';
 const response=await fetch(url,{headers:{Accept:'application/vnd.github+json','User-Agent':'sanatpish-product-volume'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('IMAGE manifest unavailable HTTP '+response.status);
 const manifest=await response.json() as any;
 if(manifest.truncated||!Array.isArray(manifest.tree))throw new Error('IMAGE manifest truncated');
 const entries=manifest.tree.filter((e:any)=>e.type==='blob').map((e:any)=>({
  name:String(e.path).slice('images/'.length),
  repoPath:String(e.path),size:Number(e.size),sha:String(e.sha)
 })) as FileEntry[];
 if(entries.length!==EXPECTED||new Set(entries.map(e=>e.name)).size!==EXPECTED||
  entries.some(e=>!/^images\/e\([1-9]\d{0,3}\)\.jpg$/.test(e.repoPath)||
    e.repoPath!=='images/'+e.name ||!/^[a-f0-9]{40}$/.test(e.sha)||
    !Number.isSafeInteger(e.size)||e.size<100||e.size>8*1024*1024)||
  entries.reduce((sum,e)=>sum+e.size,0)>100*1024*1024)
  throw new Error('Unexpected IMAGE repository contents');
 return entries.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
}
async function matches(file:string,entry:FileEntry):Promise<boolean>{
 try{
  const stat=await fs.stat(file);
  if(!stat.isFile()||stat.size!==entry.size)return false;
  return gitHash(await fs.readFile(file))===entry.sha;
 }catch{return false}
}
async function installFiles(entries:FileEntry[],root:string){
 await fs.mkdir(root,{recursive:true,mode:0o750});
 const missing:FileEntry[]=[];
 for(const entry of entries)if(!await matches(path.join(root,entry.name),entry))missing.push(entry);
 const stat=await fs.statfs(root);
 const needed=missing.reduce((sum,e)=>sum+e.size,0);
 if(stat.bavail*stat.bsize<needed+MIN_FREE)
  throw new Error('Insufficient product-volume capacity; existing PNG assets retained');
 let next=0,completed=0;
 const work=async()=>{
  while(next<missing.length){
   const entry=missing[next++];
   const output=path.join(root,entry.name);
   const temporary=output+'.'+crypto.randomUUID()+'.tmp';
   try{
    const remote='https://raw.githubusercontent.com/'+REPO+'/'+REVISION+'/'+encodeURIComponent(entry.repoPath).replace(/%2F/g,'/');
    const response=await fetch(remote,{signal:AbortSignal.timeout(45000),redirect:'error'});
    if(!response.ok)throw new Error('IMAGE blob HTTP '+response.status);
    const length=Number(response.headers.get('content-length'));
    if(Number.isFinite(length)&&length>entry.size)throw new Error('IMAGE blob exceeds expected size');
    const body=Buffer.from(await response.arrayBuffer());
    if(body.length!==entry.size||gitHash(body)!==entry.sha)throw new Error('IMAGE blob checksum mismatch');
    await fs.writeFile(temporary,body,{flag:'wx',mode:0o640});
    await fs.rename(temporary,output);
    completed++;
    if(completed%75===0||completed===missing.length)
      console.log('[Product JPG import] Verified:',completed,'of',missing.length);
   }finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
  }
 };
 await Promise.all(Array.from({length:5},()=>work()));
 for(const entry of entries)if(!await matches(path.join(root,entry.name),entry))
  throw new Error('IMAGE import incomplete: '+entry.name);
}
async function switchUrls(entries:FileEntry[]){
 const numbers=entries.map(e=>Number(e.name.match(/\((\d+)\)/)![1]));
 const pattern='(/storage/products/catalog/e\\(('+numbers.join('|')+')\\)\\.)png';
 const replacement='\\1jpg';
 return transaction(async client=>{
  await client.query("select pg_advisory_xact_lock(hashtext('sanatpish-image-jpeg-variants-v1'))");
  const changed:Record<string,number>={};
  const columns=[
   ['catalog_image_audits','image_url'],
   ['catalog_image_features','image_url'],
   ['catalog_gallery_images','url'],
   ['catalog_summary_entries','image_url'],
   ['catalog_categories','image_url']
  ] as const;
  for(const [table,column] of columns){
   const result=await client.query(
    'update public.'+table+' set '+column+'=regexp_replace('+column+',$1,$2,\'g\') where '+column+' ~ $1',
    [pattern,replacement]);
   changed[table]=result.rowCount||0;
  }
  for(const table of ['catalog_families','catalog_variants'] as const){
   const result=await client.query(
    'update public.'+table+' set images=regexp_replace(images::text,$1,$2,\'g\')::jsonb where images::text ~ $1',
    [pattern,replacement]);
   changed[table]=result.rowCount||0;
  }
  const overrides=await client.query(
   "update public.portal_kv_store set value=regexp_replace(value::text,$1,$2,'g')::jsonb where key='catalog_overrides_db_v1' and value::text ~ $1",
   [pattern,replacement]);
  changed.portal_kv_store=overrides.rowCount||0;
  const document=JSON.stringify({source:REPO,revision:REVISION,
   files:entries,destination:'/storage/products/catalog',count:entries.length});
  const sha=crypto.createHash('sha256').update(document).digest('hex');
  await client.query(
    'insert into app_private.source_archives(source_path,sha256,payload) values($1,$2,$3::jsonb) on conflict do nothing',
    ['volume-images/'+REPO+'@'+REVISION,sha,document]);
  return changed;
 });
}
let current:Promise<void>|undefined;
export function beginCatalogJpegImport(storageRoot:string,onUpdated:()=>Promise<void>){
 if(!databaseEnabled()||process.env.NODE_ENV!=='production')return Promise.resolve();
 if(current)return current;
 current=(async()=>{
  const manifest=await sourceManifest();
  const target=path.join(storageRoot,'catalog');
  await installFiles(manifest,target);
  const changes=await switchUrls(manifest);
  console.log('[Product JPG import] All verified:',manifest.length,'database URL changes:',JSON.stringify(changes));
  await onUpdated();
  void warmProductThumbs(manifest.map(e=>path.join(target,e.name)),storageRoot)
    .catch(()=>console.warn('[Product thumbnails] Background warmup incomplete'));
 })().catch(e=>{
  console.warn('[Product JPG import] Incomplete; existing PNG images remain valid:',String((e as Error)?.message||e).slice(0,200));
 }).finally(()=>{current=undefined});
 return current;
}
