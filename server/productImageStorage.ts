import {invalidatePublicCatalogCache} from './db/runtimeApi';
import type {Express,Request,Response} from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import express from 'express';
import {databaseEnabled,transaction} from './db/connection';
import {getPortalIdentity} from '../api/portal';
import {canStaff} from './db/staffPermissions';

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

export function registerProductImageStorage(app:Express,onCatalogUpdated:()=>Promise<void>){
 const root=productStorageDirectory();
 // The original 869 catalogue assets are publicly served from the mounted
 // volume. The URL never discloses a filesystem path.
 app.get('/storage/products/catalog/:file',async(req,res)=>{
  const file=String(req.params.file||'');
  const match=/^e\(([1-9]\d{0,3})\)\.png$/.exec(file);
  if(!match||Number(match[1])>869)return res.status(404).end();
  const persistentRoot=path.join(root,'catalog');
  // The mounted /data volume is authoritative. Never fall back to checked-in
  // GitHub images when an original is missing: return 404 for repair instead.
  const onVolume=await fs.stat(path.join(persistentRoot,file))
    .then(info=>info.isFile()).catch(()=>false);
  if(!onVolume)return res.status(404).end();
  return res.sendFile(file,{root:persistentRoot,dotfiles:'deny',
   headers:{'Cache-Control':'public, max-age=2592000, immutable',
    'Content-Type':'image/png','X-Content-Type-Options':'nosniff'}
  },error=>{
   if(error && !res.headersSent)res.status((error as any).status||404).end();
  });
 });
 // Legacy JPEGs from javanweb/IMAGE are stored separately; they do not
 // silently replace original PNGs or inherit unverified SKU associations.
 app.get('/storage/products/legacy-jpg/images/:file',async(req,res)=>{
  const file=String(req.params.file||'');
  if(!/^e\([1-9]\d{0,3}\)\.jpg$/.test(file))return res.status(404).end();
  return res.sendFile(file,{root:path.join(root,'legacy-jpg','images'),dotfiles:'deny',
   headers:{'Cache-Control':'public, max-age=2592000, immutable',
    'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'}
  },error=>{
   if(error && !res.headersSent)res.status((error as any).status||404).end();
  });
 });


 const thumbnailsInFlight=new Map<string,Promise<void>>();
 // Small WebP derivatives avoid transferring multi-hundred-KB PNGs to every
 // catalog card. All thumbnails are derived from exact, already-bound originals.
 app.get('/storage/products/thumbs/:file',async(req,res)=>{
  const name=String(req.params.file||'');
  const match=/^e\(([1-9]\d{0,3})\)\.webp$/.exec(name);
  if(!match||Number(match[1])>869)return res.status(404).end();
  const sourceName='e('+match[1]+').png';
  const onVolume=path.join(root,'catalog',sourceName);
  const destination=path.join(root,'thumbs',name);
  try{
   if(!(await fs.stat(destination).then(s=>s.isFile()&&s.size>0).catch(()=>false))){
    let pending=thumbnailsInFlight.get(name);
    if(!pending){
     pending=(async()=>{
      const src=onVolume;
      if(!(await fs.stat(src).then(s=>s.isFile()).catch(()=>false)))
       throw Object.assign(new Error('Image not found'),{status:404});
      await fs.mkdir(path.dirname(destination),{recursive:true,mode:0o750});
      const temp=destination+'.'+crypto.randomUUID()+'.tmp';
      try{
       await sharp(src,{limitInputPixels:MAX_PIXELS}).resize({
        width:420,height:420,fit:'inside',withoutEnlargement:true
       }).webp({quality:74,effort:1}).toFile(temp);
       await fs.rename(temp,destination);
      }finally{await fs.unlink(temp).catch(()=>{});}
     })();
     thumbnailsInFlight.set(name,pending);
     void pending.finally(()=>thumbnailsInFlight.delete(name)).catch(()=>{});
    }
    await pending;
   }
   return res.sendFile(name,{root:path.join(root,'thumbs'),dotfiles:'deny',headers:{
    'Cache-Control':'public, max-age=31536000, immutable',
    'Content-Type':'image/webp','X-Content-Type-Options':'nosniff'
   }},error=>{if(error && !res.headersSent)res.status((error as any).status||404).end();});
  }catch(error:any){
   return res.status(error?.status===404?404:503).end();
  }
 });


 // Category banners share the persistent volume but never write fake SKU/gallery entries.
 // The admin saves the returned URL in catalog_categories.image_url through /api/runtime.
 app.post('/api/catalog/category-images/upload',
  express.raw({type:['image/png','image/jpeg','image/webp'],limit:'8mb'}),
  async(req:Request,res:Response)=>{
   let temporary='';
   try{
    const identity=await getPortalIdentity(req);
    if(!canStaff(identity,'products','images'))return res.status(403).json({success:false,message:'مجوز تصاویر کاتالوگ لازم است.'});
    if(!databaseEnabled())return res.status(503).json({success:false,message:'دیتابیس متصل نیست.'});
    const raw=req.body;
    if(!Buffer.isBuffer(raw) || !raw.length || raw.length>MAX_UPLOAD_BYTES)
     return res.status(400).json({success:false,message:'تصویر معتبر با حداکثر حجم ۸ مگابایت ارسال کنید.'});
    const meta=await sharp(raw,{limitInputPixels:MAX_PIXELS}).metadata();
    if(!meta.width || !meta.height || meta.width*meta.height>MAX_PIXELS ||
       !['png','jpeg','webp'].includes(meta.format||''))
     return res.status(400).json({success:false,message:'فرمت یا ابعاد تصویر پشتیبانی نمی‌شود.'});
    const optimized=await sharp(raw,{limitInputPixels:MAX_PIXELS}).rotate()
     .resize({width:1400,height:1100,fit:'inside',withoutEnlargement:true})
     .webp({quality:82,effort:2}).toBuffer();
    const dir=await prepareProductStorage();
    const name=crypto.randomUUID()+'.webp';
    temporary=path.join(dir,'.'+name+'.tmp');
    await fs.writeFile(temporary,optimized,{flag:'wx',mode:0o640});
    await fs.rename(temporary,path.join(dir,name));
    temporary='';
    res.setHeader('Cache-Control','no-store');
    return res.status(201).json({success:true,url:'/storage/products/'+name});
   }catch(error:any){
    const status=error?.status===413?413:500;
    if(status>=500)console.error('[Category image] Storage upload failed:',String(error?.code||error?.name||'error').slice(0,60));
    return res.status(status).json({success:false,message:status===413?'حجم تصویر بیش از حد مجاز است.':'آپلود تصویر دسته‌بندی انجام نشد.'});
   }finally{if(temporary)await fs.unlink(temporary).catch(()=>{});}
  });


 // Attach a reviewed existing catalogue image to one family AND optionally its
 // approved menu path in one PostgreSQL transaction. A draft editor is not a save.
 app.post('/api/catalog/product-images/assign',async(req:Request,res:Response)=>{
  try{
   const identity=await getPortalIdentity(req);
   if(!canStaff(identity,'products','images'))return res.status(403).json({success:false,message:'مجوز اتصال تصویر محصول لازم است.'});
   if(!databaseEnabled())return res.status(503).json({success:false,message:'اتصال به PostgreSQL برقرار نیست.'});
   const familyCode=cleanCode(req.body?.familyCode);
   const imageUrl=typeof req.body?.imageUrl==='string'?req.body.imageUrl.trim():'';
   const title=typeof req.body?.title==='string'?req.body.title.trim().slice(0,180):'';
   const categorySlug=typeof req.body?.categorySlug==='string'?req.body.categorySlug.trim():'';
   const submenu=typeof req.body?.submenu==='string'?req.body.submenu.trim():'';
   const leaf=typeof req.body?.leaf==='string'?req.body.leaf.trim():'';
   const original=/^\/storage\/products\/catalog\/e\(([1-9]\d{0,3})\)\.png$/.exec(imageUrl);
   const stored=/^\/storage\/products\/([a-f0-9-]{36}\.webp)$/.exec(imageUrl);
   const legacy=/^\/storage\/products\/legacy-jpg\/images\/e\(([1-9]\d{0,3})\)\.jpg$/.exec(imageUrl);
   if(!familyCode||(!original&&!stored&&!legacy)|| (original&&Number(original[1])>869))
    return res.status(400).json({success:false,message:'تصویر باید از بانک تصاویر معتبر یا فضای ذخیره‌سازی صنعت پیش انتخاب شود؛ لینک خارجی را ابتدا آپلود کنید.'});
   if(categorySlug&&(!/^excel-v2-[0-9]+-[0-9]+$/.test(categorySlug)||!submenu||submenu.length>180||leaf.length>250))
    return res.status(400).json({success:false,message:'دسته و زیرمنوی مصوب باید به‌درستی انتخاب شوند.'});
   const diskPath=path.join(root,imageUrl.slice('/storage/products/'.length));
   if(!await fs.stat(diskPath).then(stat=>stat.isFile()).catch(()=>false))
    return res.status(404).json({success:false,message:'فایل تصویر در فضای ذخیره‌سازی اصلی موجود نیست.'});
   const image=await transaction(async client=>{
    const family=(await client.query('select code,images from public.catalog_families where code=$1 and is_active=true and not is_deleted for update',[familyCode])).rows[0];
    if(!family)throw fail(404,'خانواده انتخاب‌شده در دیتابیس یافت نشد.');
    if(categorySlug){
     const result=await client.query("select metadata from public.catalog_categories where slug=$1 and is_active=true and metadata->>'source'='industrial_megamenu_hierarchy_v2'",[categorySlug]);
     const nodes=Array.isArray(result.rows[0]?.metadata?.children)?result.rows[0].metadata.children:[];
     const node=nodes.find((item:any)=>item.name===submenu);
     if(!node||(leaf&&(!Array.isArray(node.children)||!node.children.some((item:any)=>item.name===leaf))))
      throw fail(400,'زیرمنو یا ریزقلم با دسته مصوب مطابقت ندارد.');
     const current=(await client.query('select category_slug,submenu_name,leaf_name from public.catalog_family_menu_assignments where family_code=$1 for update',[familyCode])).rows[0];
     const changed=!current||current.category_slug!==categorySlug||current.submenu_name!==submenu||(current.leaf_name||'')!==leaf;
     if(changed&&!canStaff(identity,'products','categories'))throw fail(403,'مجوز تغییر مسیر دسته‌بندی لازم است؛ هیچ اتصال تصویری ثبت نشد.');
     if(changed)await client.query(
      "insert into public.catalog_family_menu_assignments(family_code,category_slug,submenu_name,leaf_name,method) values($1,$2,$3,$4,'admin_verified') on conflict(family_code) do update set category_slug=excluded.category_slug,submenu_name=excluded.submenu_name,leaf_name=excluded.leaf_name,method=excluded.method,updated_at=now()",
      [familyCode,categorySlug,submenu,leaf||null]);
    }
    const existing=(await client.query(
     "select id,file_name,sort_order from public.catalog_gallery_images where family_code=$1 and url=$2 and scope='family' and variant_code is null order by sort_order limit 1 for update",
     [familyCode,imageUrl])).rows[0];
    const id=existing?.id||'assigned-'+crypto.randomUUID();
    const fileName=path.posix.basename(imageUrl);
    const imageTitle=title||fileName;
    if(existing){
     await client.query('update public.catalog_gallery_images set title=$2,updated_at=now() where id=$1',[id,imageTitle]);
    }else{
     await client.query(
      "insert into public.catalog_gallery_images(id,family_code,variant_code,file_name,url,scope,title,sort_order,identity_verified) values($1,$2,null,$3,$4,'family',$5,(select coalesce(max(sort_order),0)+1 from public.catalog_gallery_images where family_code=$2),false)",
      [id,familyCode,fileName,imageUrl,imageTitle]);
    }
    const images=Array.isArray(family.images)?family.images.filter((value:unknown):value is string=>typeof value==='string'):[];
    if(!images.includes(imageUrl))images.push(imageUrl);
    await client.query('update public.catalog_families set images=$2::jsonb,updated_at=now() where code=$1',[familyCode,JSON.stringify(images)]);
    // Keep a pre-existing legacy override in sync, without touching variants,
    // prices, stock, names, or technical specifications.
    const stateRow=(await client.query("select value from public.portal_kv_store where key='catalog_overrides_db_v1' for update")).rows[0];
    const state=stateRow?.value;
    if(state?.families?.[familyCode]){
     const previous=state.families[familyCode];
     const gallery=Array.isArray(previous.galleryImages)?[...previous.galleryImages]:[];
     const at=gallery.findIndex((entry:any)=>entry.id===id||(entry.scope==='family'&&entry.url===imageUrl));
     const item={id,url:imageUrl,fileName,scope:'family',title:imageTitle,identityVerified:false,order:at>=0?(gallery[at].order||at+1):gallery.length+1};
     if(at>=0)gallery[at]=item;else gallery.push(item);
     state.families[familyCode]={...previous,images:Array.from(new Set([...(Array.isArray(previous.images)?previous.images:[]),imageUrl])),galleryImages:gallery};
     await client.query("update public.portal_kv_store set value=$2::jsonb where key=$1",['catalog_overrides_db_v1',JSON.stringify(state)]);
    }
    return {id,url:imageUrl,fileName,familyCode,variantCode:null,scope:'family',title:imageTitle};
   });
   invalidatePublicCatalogCache();
   res.setHeader('Cache-Control','no-store');
   res.json({success:true,image});
   void onCatalogUpdated().catch(error=>console.warn('[Product images] Image assignment saved; refresh failed:',(error as Error)?.name||'unknown'));
  }catch(error:any){
   const status=Number(error?.status)||500;
   if(status>=500)console.error('[Product images] Assignment failed:',String(error?.code||error?.name||'unknown').slice(0,60));
   return res.status(status).json({success:false,message:status>=500?'اتصال تصویر در PostgreSQL ذخیره نشد؛ تغییرات قبلی حفظ شدند.':error.message});
  }
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
 app.post('/api/catalog/product-images/upload',express.raw({type:['image/png','image/jpeg','image/webp'],limit:'8mb'}),async(req:Request,res:Response)=>{
  let dest='';
  let temp='';
  let committed=false;
  try{
   const identity=await getPortalIdentity(req);
   if(!canStaff(identity,'products','images'))return res.status(403).json({success:false,message:'مجوز آپلود تصویر کالا لازم است.'});
   if(!databaseEnabled())return res.status(503).json({success:false,message:'اتصال به PostgreSQL الزامی است.'});
   const binaryUpload=Buffer.isBuffer(req.body);
   const requestedFamily=binaryUpload?req.query.familyCode:req.body?.familyCode;
   const requestedVariant=binaryUpload?req.query.variantCode:req.body?.variantCode;
   const requestedReplacement=binaryUpload?req.query.replaceId:req.body?.replaceId;
   const requestedTitle=binaryUpload?req.query.title:req.body?.title;
   const familyCode=cleanCode(requestedFamily);
   const variantCode=requestedVariant ? cleanCode(requestedVariant):null;
   const replaceId=requestedReplacement ? String(requestedReplacement):null;
   const title=typeof requestedTitle==='string'?requestedTitle.trim().slice(0,180):'';
   if(!familyCode || (requestedVariant && !variantCode))
    throw fail(400,'کد خانواده یا SKU معتبر نیست.');
   if(replaceId && !/^[\w.:-]{1,150}$/.test(replaceId))throw fail(400,'شناسه تصویر جایگزین نامعتبر است.');
   const raw=binaryUpload ? req.body as Buffer : parseUpload(req.body?.dataUrl);
   if(!raw.length||raw.length>MAX_UPLOAD_BYTES)throw fail(413,'حجم تصویر معتبر نیست.');
   let metadata:{width?:number;height?:number;format?:string};
   try{metadata=await sharp(raw,{limitInputPixels:MAX_PIXELS}).metadata();}
   catch{throw fail(400,'تصویر قابل خواندن نیست.');}
   if(!metadata.width||!metadata.height||metadata.width*metadata.height>MAX_PIXELS ||
      !['jpeg','png','webp'].includes(metadata.format||''))
    throw fail(400,'فرمت یا ابعاد تصویر معتبر نیست.');
   const optimized=await sharp(raw,{limitInputPixels:MAX_PIXELS})
     .rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true})
     .webp({quality:82,effort:2}).toBuffer();
   const dir=await prepareProductStorage();
   const id=crypto.randomUUID();
   const name=id+'.webp';
   dest=path.join(dir,name);
   temp=path.join(dir,'.'+id+'.tmp');
   const url='/storage/products/'+name;
   await fs.writeFile(temp,optimized,{flag:'wx',mode:0o640});
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
     await fs.rename(temp,dest);temp='';
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
   // Database data is authoritative: invalidate public cache before returning.
   // Do not hold the upload response while rebuilding 10k+ SKU search indices.
   invalidatePublicCatalogCache();
   res.setHeader('Cache-Control','no-store');
   res.status(201).json({success:true,image:gallery});
   void onCatalogUpdated().catch(error=>console.warn('[Product storage] Image saved; async index refresh failed:',(error as Error)?.name||'unknown'));
   return;
  }catch(error:any){
   if(!committed){
    if(temp)await fs.unlink(temp).catch(()=>{});
    if(dest)await fs.unlink(dest).catch(()=>{});
   }
   const status=Number(error?.status)||500;
   if(status>=500)console.error('[Product storage] Upload failed:',String(error?.code||error?.name||'error').slice(0,60));
   return res.status(status).json({success:false,message:status>=500?'ذخیره تصویر در Storage یا PostgreSQL انجام نشد.':error.message});
  }
 });

 // A single catalogue image may legitimately illustrate several SKUs. Each
 // SKU gets its own binding row; the physical file is shared and never deleted
 // when one association is removed.
 const resolveManagedImage=async(imageUrl:string)=>{
  const original=/^\/storage\/products\/catalog\/(e\([1-9]\d{0,3}\)\.png)$/.exec(imageUrl);
  const stored=/^\/storage\/products\/([a-f0-9-]{36}\.webp)$/.exec(imageUrl);
  const legacy=/^\/storage\/products\/legacy-jpg\/images\/(e\([1-9]\d{0,3}\)\.jpg)$/.exec(imageUrl);
  if(!original&&!stored&&!legacy)throw fail(400,'آدرس تصویر معتبر نیست؛ فقط تصاویر ذخیره‌شده در صنعت پیش قابل اتصال هستند.');
  const diskPath=original?path.join(root,'catalog',original[1]):stored?path.join(root,stored[1]):path.join(root,'legacy-jpg','images',legacy![1]);
  if(!await fs.stat(diskPath).then(stat=>stat.isFile()).catch(()=>false))
   throw fail(404,'فایل تصویر در فضای ذخیره‌سازی سرور پیدا نشد.');
  return {fileName:path.posix.basename(imageUrl),diskPath};
 };
 const syncImageArray=async(client:any,table:'catalog_families'|'catalog_variants',code:string,imageUrl:string,add:boolean)=>{
  const current=(await client.query('select images from public.'+table+' where code=$1 for update',[code])).rows[0];
  if(!current)return;
  const images=Array.isArray(current.images)?current.images.filter((item:unknown):item is string=>typeof item==='string'):[];
  const next=add?Array.from(new Set([...images,imageUrl])):images.filter((item:string)=>item!==imageUrl);
  if(next.length!==images.length||next.some((item:string,index:number)=>item!==images[index]))
   await client.query('update public.'+table+' set images=$2::jsonb,updated_at=now() where code=$1',[code,JSON.stringify(next)]);
 };
 const removeManagedBinding=async(client:any,binding:any)=>{
  await client.query('delete from public.catalog_gallery_images where id=$1',[binding.id]);
  if(binding.variant_code){
   const stillUsed=(await client.query('select 1 from public.catalog_gallery_images where family_code=$1 and variant_code=$2 and url=$3 and scope=\'variant\' limit 1',[binding.family_code,binding.variant_code,binding.url])).rows.length>0;
   if(!stillUsed)await syncImageArray(client,'catalog_variants',binding.variant_code,binding.url,false);
  }
  const familyStillUses=(await client.query('select 1 from public.catalog_gallery_images where family_code=$1 and url=$2 limit 1',[binding.family_code,binding.url])).rows.length>0;
  if(!familyStillUses)await syncImageArray(client,'catalog_families',binding.family_code,binding.url,false);
 };

 app.post('/api/catalog/product-images/sku-bindings',async(req:Request,res:Response)=>{
  try{
   const identity=await getPortalIdentity(req);
   if(!canStaff(identity,'products','images'))return res.status(403).json({success:false,message:'مجوز اتصال تصویر به کد کالا لازم است.'});
   if(!databaseEnabled())return res.status(503).json({success:false,message:'اتصال به PostgreSQL برقرار نیست.'});
   const imageUrl=typeof req.body?.imageUrl==='string'?req.body.imageUrl.trim():'';
   const title=typeof req.body?.title==='string'?req.body.title.trim().slice(0,180):'';
   const rawCodes=Array.isArray(req.body?.skuCodes)?req.body.skuCodes:[];
   const skuCodes=[...new Set(rawCodes.map((value:unknown)=>cleanCode(value)).filter(Boolean))] as string[];
   if(!imageUrl||!skuCodes.length||skuCodes.length>100||skuCodes.length!==rawCodes.length)
    return res.status(400).json({success:false,message:'یک تا ۱۰۰ کد کالای معتبر و یک تصویر انتخاب کنید.'});
   const {fileName}=await resolveManagedImage(imageUrl);
   const result=await transaction(async client=>{
    const variants=(await client.query('select code,family_code from public.catalog_variants where code=any($1::text[]) and active=true order by code for update',[skuCodes])).rows;
    if(variants.length!==skuCodes.length){
     const found=new Set(variants.map((row:any)=>row.code));
     throw fail(404,'این کدها در کاتالوگ فعال پیدا نشدند: '+skuCodes.filter(code=>!found.has(code)).join('، '));
    }
    const familyCodes=[...new Set(variants.map((row:any)=>String(row.family_code)))];
    const families=(await client.query('select code from public.catalog_families where code=any($1::text[]) and is_active=true and not is_deleted order by code for update',[familyCodes])).rows;
    if(families.length!==familyCodes.length)throw fail(409,'یکی از خانواده‌های کدهای انتخاب‌شده فعال نیست؛ هیچ اتصالی ثبت نشد.');
    const bindings:any[]=[];
    for(const variant of variants){
     const existing=(await client.query("select id from public.catalog_gallery_images where family_code=$1 and variant_code=$2 and url=$3 and scope='variant' order by sort_order,id limit 1 for update",[variant.family_code,variant.code,imageUrl])).rows[0];
     const id=existing?.id||'sku-image-'+crypto.randomUUID();
     if(existing){
      await client.query('update public.catalog_gallery_images set title=$2,updated_at=now() where id=$1',[id,title||fileName]);
     }else{
      await client.query("insert into public.catalog_gallery_images(id,family_code,variant_code,file_name,url,scope,title,sort_order,identity_verified) values($1,$2,$3,$4,$5,'variant',$6,(select coalesce(max(sort_order),0)+1 from public.catalog_gallery_images where family_code=$2),false)",[id,variant.family_code,variant.code,fileName,imageUrl,title||fileName]);
     }
     await syncImageArray(client,'catalog_variants',variant.code,imageUrl,true);
     await syncImageArray(client,'catalog_families',variant.family_code,imageUrl,true);
     bindings.push({id,familyCode:variant.family_code,skuCode:variant.code,url:imageUrl,fileName,scope:'variant',title:title||fileName,existing:Boolean(existing)});
    }
    return bindings;
   });
   invalidatePublicCatalogCache();
   res.setHeader('Cache-Control','no-store');
   res.json({success:true,bindings:result,created:result.filter(item=>!item.existing).length,alreadyLinked:result.filter(item=>item.existing).length});
   void onCatalogUpdated().catch(error=>console.warn('[Product image bindings] Saved; refresh failed:',(error as Error)?.name||'unknown'));
  }catch(error:any){
   const status=Number(error?.status)||500;
   if(status>=500)console.error('[Product image bindings] Batch assignment failed:',String(error?.code||error?.name||'unknown').slice(0,60));
   return res.status(status).json({success:false,message:status>=500?'اتصال گروهی تصاویر در PostgreSQL ذخیره نشد؛ تغییرات قبلی حفظ شدند.':error.message});
  }
 });

 app.patch('/api/catalog/product-images/bindings/:id',async(req:Request,res:Response)=>{
  try{
   const identity=await getPortalIdentity(req);
   if(!canStaff(identity,'products','images'))return res.status(403).json({success:false,message:'مجوز ویرایش اتصال تصویر لازم است.'});
   if(!databaseEnabled())return res.status(503).json({success:false,message:'دیتابیس متصل نیست.'});
   const id=String(req.params.id||'').trim();
   if(!/^[\w.:-]{1,150}$/.test(id))return res.status(400).json({success:false,message:'شناسه اتصال تصویر معتبر نیست.'});
   const title=req.body?.title===undefined?undefined:String(req.body.title).trim().slice(0,180);
   const identityVerified=req.body?.identityVerified===undefined?undefined:req.body.identityVerified===true;
   const hasSku=Object.prototype.hasOwnProperty.call(req.body||{},'skuCode');
   const skuCode=hasSku?cleanCode(req.body?.skuCode):'';
   const familyCode=cleanCode(req.body?.familyCode);
   const result=await transaction(async client=>{
    const old=(await client.query('select id,family_code,variant_code,url,file_name,scope,title,identity_verified from public.catalog_gallery_images where id=$1 for update',[id])).rows[0];
    if(!old)throw fail(404,'اتصال تصویر برای ویرایش پیدا نشد.');
    let targetFamily=old.family_code,targetSku=old.variant_code;
    if(hasSku){
     if(skuCode){
      const variant=(await client.query('select code,family_code from public.catalog_variants where code=$1 and active=true for update',[skuCode])).rows[0];
      if(!variant)throw fail(404,'کد کالای مقصد در کاتالوگ فعال پیدا نشد.');
      targetFamily=variant.family_code;targetSku=variant.code;
     }else{
      if(!familyCode)throw fail(400,'برای اتصال عمومی باید خانواده مقصد را انتخاب کنید.');
      const family=(await client.query('select code from public.catalog_families where code=$1 and is_active=true and not is_deleted for update',[familyCode])).rows[0];
      if(!family)throw fail(404,'خانواده مقصد فعال پیدا نشد.');
      targetFamily=family.code;targetSku=null;
     }
    }else if(familyCode){
     const family=(await client.query('select code from public.catalog_families where code=$1 and is_active=true and not is_deleted for update',[familyCode])).rows[0];
     if(!family)throw fail(404,'خانواده مقصد فعال پیدا نشد.');
     targetFamily=family.code;
     if(targetSku){
      const variant=(await client.query('select family_code from public.catalog_variants where code=$1 and active=true for update',[targetSku])).rows[0];
      if(!variant)throw fail(409,'کد متصل دیگر فعال نیست؛ ابتدا نوع اتصال را به خانواده تغییر دهید.');
      if(variant.family_code!==targetFamily)throw fail(400,'برای تغییر خانواده واقعی کد، از عملیات «انتقال کد کالا» استفاده کنید.');
     }
    }
    const nextTitle=title===undefined?old.title:title;
    const nextVerified=identityVerified===undefined?old.identity_verified:identityVerified;
    await client.query('update public.catalog_gallery_images set family_code=$2,variant_code=$3,scope=$4,title=$5,identity_verified=$6,updated_at=now() where id=$1',[id,targetFamily,targetSku,targetSku?'variant':'family',nextTitle,nextVerified]);
    if(old.variant_code && (old.variant_code!==targetSku || old.family_code!==targetFamily)){
     const stillUsed=(await client.query("select 1 from public.catalog_gallery_images where family_code=$1 and variant_code=$2 and url=$3 and scope='variant' and id<>$4 limit 1",[old.family_code,old.variant_code,old.url,id])).rows.length>0;
     if(!stillUsed)await syncImageArray(client,'catalog_variants',old.variant_code,old.url,false);
    }
    if(old.family_code!==targetFamily){
     const oldFamilyStillUses=(await client.query('select 1 from public.catalog_gallery_images where family_code=$1 and url=$2 and id<>$3 limit 1',[old.family_code,old.url,id])).rows.length>0;
     if(!oldFamilyStillUses)await syncImageArray(client,'catalog_families',old.family_code,old.url,false);
    }
    if(targetSku)await syncImageArray(client,'catalog_variants',targetSku,old.url,true);
    await syncImageArray(client,'catalog_families',targetFamily,old.url,true);
    return {id,familyCode:targetFamily,skuCode:targetSku,url:old.url,title:nextTitle,identityVerified:nextVerified};
   });
   invalidatePublicCatalogCache();
   res.setHeader('Cache-Control','no-store');
   res.json({success:true,binding:result});
   void onCatalogUpdated().catch(error=>console.warn('[Product image bindings] Edit saved; refresh failed:',(error as Error)?.name||'unknown'));
  }catch(error:any){
   const status=Number(error?.status)||500;
   if(status>=500)console.error('[Product image bindings] Edit failed:',String(error?.code||error?.name||'unknown').slice(0,60));
   return res.status(status).json({success:false,message:status>=500?'ویرایش اتصال تصویر ذخیره نشد؛ اطلاعات قبلی حفظ شدند.':error.message});
  }
 });

 app.delete('/api/catalog/product-images/bindings/:id',async(req:Request,res:Response)=>{
  try{
   const identity=await getPortalIdentity(req);
   if(!canStaff(identity,'products','images'))return res.status(403).json({success:false,message:'مجوز حذف اتصال تصویر لازم است.'});
   if(!databaseEnabled())return res.status(503).json({success:false,message:'دیتابیس متصل نیست.'});
   const id=String(req.params.id||'').trim();
   if(!/^[\w.:-]{1,150}$/.test(id))return res.status(400).json({success:false,message:'شناسه اتصال تصویر معتبر نیست.'});
   const result=await transaction(async client=>{
    const binding=(await client.query('select id,family_code,variant_code,url,scope from public.catalog_gallery_images where id=$1 for update',[id])).rows[0];
    if(!binding)throw fail(404,'اتصال تصویر قبلاً حذف شده یا وجود ندارد.');
    await removeManagedBinding(client,binding);
    return {id,familyCode:binding.family_code,skuCode:binding.variant_code,url:binding.url};
   });
   invalidatePublicCatalogCache();
   res.setHeader('Cache-Control','no-store');
   res.json({success:true,removed:result});
   void onCatalogUpdated().catch(error=>console.warn('[Product image bindings] Delete saved; refresh failed:',(error as Error)?.name||'unknown'));
  }catch(error:any){
   const status=Number(error?.status)||500;
   if(status>=500)console.error('[Product image bindings] Delete failed:',String(error?.code||error?.name||'unknown').slice(0,60));
   return res.status(status).json({success:false,message:status>=500?'حذف اتصال تصویر انجام نشد؛ اطلاعات قبلی حفظ شدند.':error.message});
  }
 });

}
