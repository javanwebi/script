/**
 * One-time, non-destructive import of the official PNG image catalogue and the
 * independently supplied IMAGE JPEG repository into a persistent Railway volume.
 *
 * Never infer SKU bindings from numbered filenames. Only existing catalogue PNG
 * URLs are switched to local files, after checking EVERY source Git blob.
 */
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {transaction,databaseEnabled} from './db/connection';

type GithubFile={path:string;size:number;sha:string;type:string};
export type ImageImportSource={
 repo:string;commit:string;target:string;count:number;pattern:RegExp;
};
export const IMAGE_IMPORT_SOURCES:ImageImportSource[]=[
 {repo:'javanweb/imagesatlas',commit:'5bbaec971a05771939663d47803b5d5c2c624c6d',target:'catalog',count:869,pattern:/^e\([1-9]\d{0,3}\)\.png$/},
 {repo:'javanweb/IMAGE',commit:'5e8fadaef9f16d0ed03dae3462b60cae4c2a50e6',target:'IMAGE',count:725,pattern:/^images\/e\([1-9]\d{0,3}\)\.jpg$/},
];
const reserveBytes=48*1024*1024;
const sourcePrefix='https://raw.githubusercontent.com/javanweb/imagesatlas/main/';
const cdnPrefix='https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@main/';
const destinationPrefix='/storage/products/catalog/';
const maximumTreeBytes=3*1024*1024;

function safeFileName(relative:string,source:ImageImportSource):boolean{
 return source.pattern.test(relative) && !relative.includes('..');
}
async function fileGitSha(filename:string):Promise<string>{
 const bytes=await fs.readFile(filename);
 return crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
async function githubTree(source:ImageImportSource):Promise<GithubFile[]>{
 const url=`https://api.github.com/repos/${source.repo}/git/trees/${source.commit}?recursive=1`;
 const response=await fetch(url,{headers:{'Accept':'application/vnd.github+json','User-Agent':'sanatpish-catalog-volume-migration'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('GitHub image manifest unavailable: '+source.repo+' HTTP '+response.status);
 const payload=await response.text();
 if(payload.length>maximumTreeBytes)throw new Error('GitHub manifest too large');
 const tree=JSON.parse(payload);
 if(tree.truncated||!Array.isArray(tree.tree))throw new Error('GitHub image manifest incomplete');
 const files=tree.tree.filter((row:any)=>row.type==='blob').map((row:any)=>({
  path:String(row.path),size:Number(row.size),sha:String(row.sha),type:String(row.type)
 })) as GithubFile[];
 if(files.length!==source.count || files.some(f=>!safeFileName(f.path,source)||!Number.isSafeInteger(f.size)||f.size<1||!/^[a-f0-9]{40}$/.test(f.sha)))
  throw new Error('Unexpected GitHub image manifest for '+source.repo);
 return files;
}
async function verified(files:GithubFile[],target:string):Promise<boolean>{
 for(const file of files){
  const name=path.join(target,...file.path.split('/'));
  try{
   if((await fs.stat(name)).size!==file.size)return false;
   if(await fileGitSha(name)!==file.sha)return false;
  }catch{return false;}
 }
 return true;
}
async function extractPinnedArchive(source:ImageImportSource,target:string){
 await fs.mkdir(target,{recursive:true,mode:0o750});
 const url=`https://codeload.github.com/${source.repo}/tar.gz/${source.commit}`;
 const response=await fetch(url,{signal:AbortSignal.timeout(15*60*1000)});
 if(!response.ok||!response.body)throw new Error('Source image archive unavailable: '+source.repo+' HTTP '+response.status);
 const child=spawn('tar',['-xz','--no-same-owner','--no-same-permissions','--strip-components=1','-C',target],{stdio:['pipe','ignore','pipe']});
 let stderr='';
 child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-500);});
 const exit=new Promise<void>((resolve,reject)=>{
  child.on('error',reject);
  child.on('close',code=>code===0?resolve():reject(new Error('Archive extraction failed: '+source.repo+' exit '+code+' '+stderr.slice(0,90))));
 });
 try{
  await pipeline(Readable.fromWeb(response.body as any),child.stdin);
  await exit;
 }catch(error){
  child.kill();
  await exit.catch(()=>{});
  throw error;
 }
}
async function ensureSource(source:ImageImportSource,root:string){
 const files=await githubTree(source);
 const destination=path.join(root,source.target);
 if(!await verified(files,destination)){
  const requiredBytes=files.reduce((total,f)=>total+f.size,0);
  const stat=await fs.statfs(root);
  // Mounted volumes are not backups. Keep an extra reserve for new admin photos.
  const available=stat.bavail*stat.bsize;
  if(available<requiredBytes+reserveBytes)
   throw new Error('Insufficient persistent-volume capacity for '+source.repo);
  await extractPinnedArchive(source,destination);
  if(!await verified(files,destination))
   throw new Error('Imported images differ from GitHub SHA-1 manifest: '+source.repo);
 }
 return files;
}
/** Replace only the known original PNG URLs, not user URLs or independently imported JPEGs. */
export async function commitVolumeCatalogUrls(sources:{source:ImageImportSource;files:GithubFile[]}[]){
 if(!databaseEnabled())throw new Error('PostgreSQL is required');
 const originals=sources.find(item=>item.source.target==='catalog')?.files||[];
 const imported=sources.find(item=>item.source.target==='IMAGE')?.files||[];
 if(originals.length!==869||imported.length!==725)throw new Error('Incomplete image import');
 return transaction(async client=>{
  await client.query("select pg_advisory_xact_lock(hashtext('sanatpish-image-volume-import-v1'))");
  for(const {source,files} of sources){
   const payload={
    type:'persistent-volume-image-import',sourceRepo:source.repo,commit:source.commit,
    root:'/storage/products/'+source.target+'/',count:files.length,
    entries:files.map(file=>({
     fileName:file.path,gitSha:file.sha,size:file.size,
     url:'/storage/products/'+source.target+'/'+file.path
    }))
   };
   const serialized=JSON.stringify(payload);
   const checksum=crypto.createHash('sha256').update(serialized).digest('hex');
   await client.query(
    `insert into app_private.source_archives(source_path,sha256,payload)
     values($1,$2,$3::jsonb) on conflict(source_path,sha256) do nothing`,
    ['volume-images/'+source.repo+'@'+source.commit,checksum,serialized]
   );
  }
  const replacements=[
   [sourcePrefix,destinationPrefix],
   [cdnPrefix,destinationPrefix]
  ];
  const changed:Record<string,number>={};
  const urlColumns=[
   ['catalog_image_audits','image_url'],['catalog_image_features','image_url'],
   ['catalog_gallery_images','url'],['catalog_summary_entries','image_url'],
   ['catalog_categories','image_url']
  ] as const;
  for(const [table,column] of urlColumns){
   const sql=`update public.${table} set ${column}=replace(replace(${column},$1,$3),$2,$3)
    where ${column} like $4 or ${column} like $5`;
   const result=await client.query(sql,[sourcePrefix,cdnPrefix,destinationPrefix,sourcePrefix+'e(%',cdnPrefix+'e(%']);
   changed[table]=result.rowCount||0;
  }
  for(const table of ['catalog_families','catalog_variants'] as const){
   const result=await client.query(
    `update public.${table} set images=replace(replace(images::text,$1,$3),$2,$3)::jsonb
     where images::text like $4 or images::text like $5`,
    [sourcePrefix,cdnPrefix,destinationPrefix,'%'+sourcePrefix+'e(%','%'+cdnPrefix+'e(%']
   );
   changed[table]=result.rowCount||0;
  }
  // Historic admin overrides must not reintroduce GitHub links.
  const overrides=await client.query(
   `update public.portal_kv_store
    set value=replace(replace(value::text,$1,$3),$2,$3)::jsonb
    where key='catalog_overrides_db_v1' and (value::text like $4 or value::text like $5)`,
   [sourcePrefix,cdnPrefix,destinationPrefix,'%'+sourcePrefix+'e(%','%'+cdnPrefix+'e(%']
  );
  changed.portal_kv_store=overrides.rowCount||0;
  return changed;
 });
}
let running:Promise<void>|null=null;
/** Called once per app process; async so existing server can serve during migration. */
export function beginImageVolumeMigration(root:string,onUpdated:()=>Promise<void>){
 if(!databaseEnabled()||process.env.NODE_ENV!=='production')return Promise.resolve();
 if(running)return running;
 running=(async()=>{
  const sources=[] as {source:ImageImportSource;files:GithubFile[]}[];
  for(const source of IMAGE_IMPORT_SOURCES){
   const files=await ensureSource(source,root);
   console.log('[Product images] Verified on persistent volume:',source.repo,files.length);
   sources.push({source,files});
  }
  const counts=await commitVolumeCatalogUrls(sources);
  console.log('[Product images] Canonical PostgreSQL image URLs now use persistent storage:',JSON.stringify(counts));
  await onUpdated();
 })().catch((error)=>{
  console.error('[Product images] Volume migration not completed; old database URLs remain until verified:',String((error as Error)?.message||'error').slice(0,200));
 }).finally(()=>{running=null;});
 return running;
}
