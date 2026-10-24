import type {Express,Request,Response} from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import express from 'express';
import {databaseEnabled,transaction} from './db/connection';
import {getPortalIdentity} from '../api/portal';

const MAX_UPLOAD_BYTES=8*1024*1024;
const MAX_PIXELS=24_000_000;
export const productStorageDirectory = () =>
  process.env.PRODUCT_STORAGE_DIR ||
  (process.env.NODE_ENV==='production' ? '/data/storage/products' : path.join(process.cwd(),'storage','products'));

export async function prepareProductStorage(){
 const root=productStorageDirectory();
 if(process.env.NODE_ENV==='production' && !path.isAbsolute(root))
  throw new Error('Production product storage must be an absolute mounted-volume path');
 if(process.env.NODE_ENV==='production' && !root.startsWith('/data/'))
  throw new Error('Production product storage must be inside the mounted /data volume');
 await fs.mkdir(root,{recursive:true,mode:0o750});
 await fs.access(root,fs.constants.W_OK);
 return root;
}

function parseUpload(dataUrl:unknown):Buffer {
 if(typeof dataUrl!=='string')throw Object.assign(new Error('فایل تصویر ارسال نشده است.'),{status:400});
 const match=/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/i.exec(dataUrl);
 if(!match||match[2].length>MAX_UPLOAD_BYTES*4/3+8)
  throw Object.assign(new Error('فقط تصویر PNG، JPEG یا WebP با حجم حداکثر ۸ مگابایت مجاز است.'),{status:400});
 const buffer=Buffer.from(match[2],'base64');
 if(!buffer.length||buffer.length>MAX_UPLOAD_BYTES)throw Object.assign(new Error('حجم تصویر معتبر نیست.'),{status:413});
 return buffer;
}

function cleanCode(value:unknown):string {
 return typeof value==='string' && /^[\p{L}\p{N}_.-]{1,110}$/u.test(value.trim()) ? value.trim() : '';
}
const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});

/**
 * GitHub is an optional off-server binary store. Only this backend has access
 * to the Contents:write credential; the browser receives an immutable CDN URL.
 * The token must have access specifically to javanweb/imagesatlas.
 */
const IMAGE_REPO='javanweb/imagesatlas';
const IMAGE_BRANCH='main';
async function saveGitHubProductImage(name:string,optimized:Buffer):Promise<{url:string;contentSha:string}|null>{
 const token=process.env.PRODUCT_IMAGE_GITHUB_TOKEN;
 if(!token)return null; // Existing volume uploads keep working until repo write access is configured.
 const location='storage/products/'+name;
 const response=await fetch('https://api.github.com/repos/'+IMAGE_REPO+'/contents/'+location,{
  method:'PUT',
  headers:{
   'Authorization':'Bearer '+token,
   'Accept':'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',
   'User-Agent':'sanatpish-product-image-upload',
   'Content-Type':'application/json'
  },
  body:JSON.stringify({message:'Add product image '+name,content:optimized.toString('base64'),branch:IMAGE_BRANCH}),
  signal:AbortSignal.timeout(30000)
 });
 if(response.status!==201)throw fail(502,'مجوز نوشتن در مخزن تصاویر GitHub یا ارتباط آن بررسی شود.');
 const result=await response.json() as {commit?:{sha?:string};content?:{sha?:string}};
 const commit=result.commit?.sha||'',sha=result.content?.sha||'';
 if(!/^[a-f0-9]{40}$/.test(commit)||!/^[a-f0-9]{40}$/.test(sha))
  throw fail(502,'تأیید نسخه ذخیره‌شده تصویر در GitHub ناموفق بود.');
 return {url:'https://cdn.jsdelivr.net/gh/'+IMAGE_REPO+'@'+commit+'/'+location,contentSha:sha};
}
async function deleteUncommittedGithubImage(name:string,sha:string):Promise<void>{
 const token=process.env.PRODUCT_IMAGE_GITHUB_TOKEN;
 if(!token||!/^[a-f0-9]{40}$/.test(sha))return;
 await fetch('https://api.github.com/repos/'+IMAGE_REPO+'/contents/storage/products/'+name,{
  method:'DELETE',
  headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
  body:JSON.stringify({message:'Rollback unlinked product upload '+name,sha,branch:IMAGE_BRANCH}),
  signal:AbortSignal.timeout(20000)
 }).catch(()=>{});
}


export function registerProductImageStorage(app:Express,onCatalogUpdated:()=>Promise<void>){
 const root=productStorageDirectory();
 // The original 869 catalogue assets are publicly served from the mounted
 // volume. The URL never discloses a filesystem path.
 app.get('/storage/products/catalog/:file',(req,res)=>{
  const file=String(req.params.file||'');
  const match=/^e\\(([1-9]\\d{0,3})\\)\\.png$/.exec(file);
  if(!match||Number(match[1])>869)return res.status(404).end();
  return res.redirect(301,'https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@5bbaec971a05771939663d47803b5d5c2c624c6d/'+encodeURIComponent(file));
 });
 // Immutable random filenames: updating/replacing product images never mutates an old URL.
 app.get('/storage/products/:file',async(req,res)=>{
  const name=String(req.params.file||'');
  if(!/^[a-f0-9-]{36}\.webp$/.test(name))return res.status(404).end();
  return res.sendFile(name,{root,dotfiles:'deny',headers:{
   'Cache-Control':'public, max-age=31536000, immutable',
   'Content-Type':'image/webp','X-Content-Type-Options':'nosniff'
  }},(error)=>{if(error && !res.headersSent)res.status((error as any).status||404).end();});
 });

 // /api/catalog is already guarded by requirePortalAdmin in server.ts.
 app.post('/api/catalog/product-images/upload',async(req:Request,res:Response)=>{
  let dest='';
  let temp='';
  let committed=false;
  let githubImage:{url:string;contentSha:string}|null=null;
  let uploadedName='';
  try{
   const identity=await getPortalIdentity(req);
   if(!identity.admin)return res.status(403).json({success:false,message:'فقط مدیر سایت اجازه بارگذاری تصاویر کالا را دارد.'});
   if(!databaseEnabled())return res.status(503).json({success:false,message:'اتصال به PostgreSQL الزامی است.'});
   const familyCode=cleanCode(req.body?.familyCode);
   const variantCode=req.body?.variantCode ? cleanCode(req.body.variantCode):null;
   const replaceId=req.body?.replaceId ? String(req.body.replaceId):null;
   const title=typeof req.body?.title==='string'?req.body.title.trim().slice(0,180):'';
   if(!familyCode || (req.body?.variantCode && !variantCode))
    throw fail(400,'کد خانواده یا SKU معتبر نیست.');
   if(replaceId && !/^[\w.:-]{1,150}$/.test(replaceId))throw fail(400,'شناسه تصویر جایگزین نامعتبر است.');
   const raw=parseUpload(req.body?.dataUrl);
   let metadata:{width?:number;height?:number;format?:string};
   try{metadata=await sharp(raw,{limitInputPixels:MAX_PIXELS}).metadata();}
   catch{throw fail(400,'تصویر قابل خواندن نیست.');}
   if(!metadata.width||!metadata.height||metadata.width*metadata.height>MAX_PIXELS ||
      !['jpeg','png','webp'].includes(metadata.format||''))
    throw fail(400,'فرمت یا ابعاد تصویر معتبر نیست.');
   const optimized=await sharp(raw,{limitInputPixels:MAX_PIXELS})
     .rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true})
     .webp({quality:84,effort:4}).toBuffer();
   const id=crypto.randomUUID();
   const name=id+'.webp';
   uploadedName=name;
   // When the narrowly scoped GitHub token exists, store ONLY in GitHub.
   // Otherwise retain the existing reliable volume flow until authorized.
   githubImage=await saveGitHubProductImage(name,optimized);
   const url=githubImage?.url || '/storage/products/'+name;
   if(!githubImage){
    const dir=await prepareProductStorage();
    dest=path.join(dir,name);
    temp=path.join(dir,'.'+id+'.tmp');
    await fs.writeFile(temp,optimized,{flag:'wx',mode:0o640});
   }
   const gallery=await transaction(async client=>{
     const family=(await client.query('select code,images from public.catalog_families where code=$1 and is_active=true and not is_deleted for update',[familyCode])).rows[0];
     if(!family)throw fail(404,'ابتدا خانواده کالا را در دیتابیس ذخیره کنید.');
     const variant=variantCode?(await client.query('select code,images from public.catalog_variants where code=$1 and family_code=$2 and active=true for update',[variantCode,familyCode])).rows[0]:null;
     if(variantCode && !variant)throw fail(400,'کد کالا در این خانواده وجود ندارد.');
     const old=replaceId?(await client.query('select id,url,family_code,variant_code from public.catalog_gallery_images where id=$1 and family_code=$2 for update',[replaceId,familyCode])).rows[0]:null;
     if(replaceId && !old)throw fail(404,'تصویر قدیمی در این خانواده یافت نشد.');
     const oldUrl=old?.url;
     const galleryId=replaceId||'storage-'+id;
     const pictures=(value:unknown)=>Array.isArray(value)?value.filter(x=>typeof x==='string') as string[]:[];
     const adjust=(value:unknown)=>{
       const images=pictures(value).filter((v:string)=>v!==oldUrl || !replaceId);
       if(!images.includes(url))images.push(url);
       return images;
     };
     // Verify the volume write before recording the URL, inside the same transaction.
     if(temp){await fs.rename(temp,dest);temp='';}
     if(old){
       await client.query(`update public.catalog_gallery_images set url=$2,file_name=$3,variant_code=$4,scope=$5,title=$6,identity_verified=false,updated_at=now() where id=$1`,
        [galleryId,url,name,variantCode,variantCode?'variant':'family',title||name]);
     }else{
       await client.query(`insert into public.catalog_gallery_images(id,family_code,variant_code,file_name,url,scope,title,sort_order,identity_verified)
         values($1,$2,$3,$4,$5,$6,$7,(select coalesce(max(sort_order),0)+1 from public.catalog_gallery_images where family_code=$2),false)`,
         [galleryId,familyCode,variantCode,name,url,variantCode?'variant':'family',title||name]);
     }
     await client.query('update public.catalog_families set images=$2::jsonb,updated_at=now() where code=$1',[familyCode,JSON.stringify(adjust(family.images))]);
     if(variantCode)await client.query('update public.catalog_variants set images=$2::jsonb,updated_at=now() where code=$1',[variantCode,JSON.stringify(adjust(variant.images))]);
     else if(old?.variant_code){
       // Moving a previously SKU-bound photo back to the family scope.
       const prior=(await client.query('select images from public.catalog_variants where code=$1 for update',[old.variant_code])).rows[0];
       if(prior)await client.query('update public.catalog_variants set images=$2::jsonb where code=$1',[old.variant_code,JSON.stringify(pictures(prior.images).filter((x:string)=>x!==oldUrl))]);
     }
     // Historical admin overrides may still be displayed over normalized tables.
     // Update only their image fields, preserving prices, names, codes and specs.
     const state=(await client.query("select value from public.portal_kv_store where key='catalog_overrides_db_v1' for update")).rows[0]?.value;
     if(state?.families?.[familyCode]){
       const original=state.families[familyCode];
       const galleryImages=Array.isArray(original.galleryImages)?[...original.galleryImages]:[];
       const previous=galleryImages.findIndex((entry:any)=>entry.id===galleryId);
       const updated={id:galleryId,url,fileName:name,scope:variantCode?'variant':'family',
         variantCode:variantCode||undefined,title:title||name,identityVerified:false,
         order:previous>=0?galleryImages[previous].order:galleryImages.length+1};
       if(previous>=0)galleryImages[previous]=updated;else galleryImages.push(updated);
       const patchedVariants=Array.isArray(original.variants)?original.variants.map((entry:any)=>{
         if(variantCode && entry.code===variantCode)return {...entry,images:adjust(entry.images)};
         if(old?.variant_code && entry.code===old.variant_code && !variantCode)
           return {...entry,images:pictures(entry.images).filter((x:string)=>x!==oldUrl)};
         return entry;
       }):original.variants;
       state.families[familyCode]={...original,images:adjust(original.images),
         galleryImages,variants:patchedVariants};
       await client.query("update public.portal_kv_store set value=$2::jsonb where key=$1",
         ['catalog_overrides_db_v1',JSON.stringify(state)]);
     }
     return {id:galleryId,url,fileName:name,familyCode,variantCode,scope:variantCode?'variant':'family',title:title||name};
   });
   committed=true;
   try{await onCatalogUpdated();}catch(error){console.warn('[Product storage] Persisted image; in-memory refresh failed:',(error as Error)?.name||'unknown');}
   return res.status(201).json({success:true,image:gallery});
  }catch(error:any){
   if(!committed){
    if(temp)await fs.unlink(temp).catch(()=>{});
    if(dest)await fs.unlink(dest).catch(()=>{});
    if(githubImage&&uploadedName)await deleteUncommittedGithubImage(uploadedName,githubImage.contentSha);
   }
   const status=Number(error?.status)||500;
   if(status>=500)console.error('[Product storage] Upload failed:',String(error?.code||error?.name||'error').slice(0,60));
   return res.status(status).json({success:false,message:status>=500?'ذخیره تصویر در Storage یا PostgreSQL انجام نشد.':error.message});
  }
 });
}
