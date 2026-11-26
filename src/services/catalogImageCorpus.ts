import { hashStringSync } from '../utils/cryptoUtils';
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
    if (/^https?:/i.test(text)) {
      const url=new URL(text);
      if (!(url.hostname==='raw.githubusercontent.com' && url.pathname.startsWith('/javanweb/imagesatlas/main/')) &&
          !(url.hostname==='cdn.jsdelivr.net' && url.pathname.startsWith('/gh/javanweb/imagesatlas@main/'))) return;
    } else if (!/^e\(\d+\)\.png$/i.test(text) && !/^\/storage\/products\/catalog\/e\(\d+\)\.png$/i.test(text)) return;
    const n=Number(text.match(/e\((\d+)\)\.png(?:$|[?#])/i)?.[1]);
    if(Number.isInteger(n) && n>=1 && n<=869)return `e(${n}).png`;
  } catch { /* invalid URL is not an official asset */ }
}
/** The corpus includes all 869 photos, including photos with no SKU association. */
export function buildCatalogImageCorpus(products:Product[], revision=''):CatalogImageRecord[] {
  const images=new Map<string,CatalogImageRecord>();
  for(const item of audits) images.set(item.file_name,{id:item.file_name,url:getProductImageUrl(item.image_url || item.file_name),
    label:headings.get(item.file_name) || item.observed_description || item.file_name,revision:item.sha256 || revision,bindings:[]});
  const add=(url:string,binding:ImageBinding,label:string)=>{
    if(!url || /^blob:/i.test(url))return;
    const key=officialImageFile(url) || `upload-${hashStringSync(url).slice(0,24)}`;
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
  return hashStringSync(JSON.stringify(images));
}


/** The POPD archive has one official photo per exact SKU. Ignore legacy gallery
 * aliases and family artwork; only the canonical variant's own URL can bind it.
 * Revision keys are verified against the actual mounted file bytes by the server.
 */
export function buildPopdVisionCorpus(products:Product[],revisions:ReadonlyMap<string,string>):CatalogImageRecord[]{
 const rows=new Map<string,CatalogImageRecord>();
 const codes=new Set<string>();
 for(const family of products){
  if(family.active===false)continue;
  for(const variant of family.variants || []){
   if(variant.active===false)continue;
   for(const url of variant.images || []){
    const id=officialImageFile(url);
    if(!id)continue;
    const revision=revisions.get(id);
    if(!revision || rows.has(id) || codes.has(variant.code))
     throw new Error('Invalid or duplicate POPD vision photo binding: '+id);
    codes.add(variant.code);
    rows.set(id,{id,url:getProductImageUrl(id),label:variant.name || family.name,revision,
     bindings:[{familyCode:family.code,code:variant.code,verified:true}]});
   }
  }
 }
 if(rows.size!==869 || revisions.size!==869 || Array.from({length:869},(_,i)=>'e('+(i+1)+').png').some(id=>!rows.has(id)))
  throw new Error('POPD vision requires 869 unique active exact SKU image bindings; found '+rows.size);
 return [...rows.values()];
}
