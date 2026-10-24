import { createHash } from 'node:crypto';
import type { Product } from '../types';
import {getProductImageUrl} from '../assets/imagesproducts';

export interface ImageBinding { familyCode:string; code?:string; verified:boolean; }
export interface CatalogImageRecord {id:string;url:string;label:string;revision:string;bindings:ImageBinding[];}
export interface ImageAuditMetadata { file_name:string; image_url:string|null; sha256:string|null; observed_description:string|null; }
export interface OwnerPhotoMetadata { file_name:string; catalogue_group:string|null; }
let audits:ImageAuditMetadata[]=[];
let headings=new Map<string,string>();
export function installCatalogImageMetadata(rows:ImageAuditMetadata[],photos:OwnerPhotoMetadata[]){
  audits=rows;
  headings=new Map(photos.filter(p=>p.catalogue_group).map(p=>[p.file_name,p.catalogue_group!]));
}
export function officialImageFile(value:string): string | undefined {
 try {
  const text=decodeURIComponent(value.trim());
  let name='';
  if(/^https?:/i.test(text)) {
   const u=new URL(text);
   if(u.protocol!=='https:' || u.username || u.password)return;
   const parts=u.pathname.split('/').filter(Boolean);
   const raw=u.hostname==='raw.githubusercontent.com'
     && parts.length===4 && parts[0]==='javanweb' && parts[1]==='imagesatlas'
     && (parts[2]==='main'||/^[a-f0-9]{40}$/.test(parts[2]));
   const cdn=u.hostname==='cdn.jsdelivr.net'
     && parts.length===4 && parts[0]==='gh' && parts[1]==='javanweb'
     && /^(imagesatlas@main|imagesatlas@[a-f0-9]{40})$/.test(parts[2]);
   // CDN path must be: gh/javanweb/imagesatlas@COMMIT/FILE.
   // Raw GitHub path must be: javanweb/imagesatlas/COMMIT/FILE.
   if(!raw && !cdn)return;
   name=parts[3];
  } else if(text.startsWith('/storage/products/catalog/')){
   name=text.slice('/storage/products/catalog/'.length);
  } else {
   name=text;
  }
  const found=/^e\(([1-9]\d{0,3})\)\.png$/.exec(name);
  if(!found)return;
  const n=Number(found[1]);
  if(n>=1&&n<=869)return `e(${n}).png`;
 }catch{/* invalid URL */}
}

/** The corpus includes all 869 photos, including photos with no SKU association. */
export function buildCatalogImageCorpus(products:Product[], revision=''):CatalogImageRecord[] {
  const images=new Map<string,CatalogImageRecord>();
  for(const item of audits) images.set(item.file_name,{id:item.file_name,url:getProductImageUrl(item.image_url || item.file_name),
    label:headings.get(item.file_name) || item.observed_description || item.file_name,revision:item.sha256 || revision,bindings:[]});
  const add=(rawUrl:string,binding:ImageBinding,label:string)=>{
    const url=getProductImageUrl(rawUrl);
    if(!url || /^blob:/i.test(url))return;
    const key=officialImageFile(url) || `upload-${createHash('sha256').update(url).digest('hex').slice(0,24)}`;
    let image=images.get(key);
    if(!image){image={id:key,url,label,revision,bindings:[]};images.set(key,image);}
    if(!image.bindings.some(b=>b.familyCode===binding.familyCode && b.code===binding.code))image.bindings.push(binding);
    else if(binding.verified)image.bindings.find(b=>b.familyCode===binding.familyCode && b.code===binding.code)!.verified=true;
  };
  for(const product of products.filter(p=>p.active!==false)) {
    const codes=new Set((product.variants || []).filter(v=>v.active!==false).map(v=>v.code));
    for(const image of product.galleryImages || []) {
      if(image.scope==='variant' && (!image.variantCode || !codes.has(image.variantCode)))continue;
      add(image.url,{familyCode:product.code,code:image.scope==='variant' ? image.variantCode : undefined,
        verified:image.scope==='variant' && image.identityVerified===true},image.title || product.name);
    }
    for(const url of product.images || [])add(url,{familyCode:product.code,verified:false},product.name);
    for(const variant of product.variants || [])if(variant.active!==false)for(const url of variant.images || [])
      add(url,{familyCode:product.code,code:variant.code,verified:false},variant.name);
  }
  return [...images.values()];
}
export function corpusFingerprint(images:CatalogImageRecord[]) {
  return createHash('sha256').update(JSON.stringify(images)).digest('hex');
}
