import { createHash } from 'node:crypto';
import type { Product } from '../types';
import review from '../../docs/product-image-review.json';
import ownerPhotos from '../data/ownerCataloguePhotos.json';

export interface ImageBinding { familyCode:string; code?:string; verified:boolean; }
export interface CatalogImageRecord {id:string;url:string;label:string;revision:string;bindings:ImageBinding[];}
const headings=new Map(ownerPhotos.items.map(item=>[item.file,item.catalogueGroup]));
export function officialImageFile(value:string): string | undefined {
  try {
    const text=decodeURIComponent(value.trim());
    if (/^https?:/i.test(text)) {
      const url=new URL(text);
      if (!(url.hostname==='raw.githubusercontent.com' && url.pathname.startsWith('/javanweb/imagesatlas/main/')) &&
          !(url.hostname==='cdn.jsdelivr.net' && url.pathname.startsWith('/gh/javanweb/imagesatlas@main/'))) return;
    } else if (!/^e\(\d+\)\.png$/i.test(text)) return;
    const n=Number(text.match(/e\((\d+)\)\.png(?:$|[?#])/i)?.[1]);
    if(Number.isInteger(n) && n>=1 && n<=869)return `e(${n}).png`;
  } catch { /* invalid URL is not an official asset */ }
}
/** The corpus includes all 869 photos, including photos with no SKU association. */
export function buildCatalogImageCorpus(products:Product[], revision=''):CatalogImageRecord[] {
  const images=new Map<string,CatalogImageRecord>();
  for(const item of review.items) images.set(item.file,{id:item.file,url:`https://raw.githubusercontent.com/javanweb/imagesatlas/main/${item.file}`,
    label:headings.get(item.file) || item.observed,revision:item.sha256,bindings:[]});
  const add=(url:string,binding:ImageBinding,label:string)=>{
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
