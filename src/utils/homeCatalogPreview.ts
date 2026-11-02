import {getProductImageUrl} from '../assets/imagesproducts';

/** A tiny, public, read-only homepage teaser. Never send commercial SKU data. */
export interface HomePreviewProduct {
  code:string;
  name:string;
  brand:string;
  categorySlug:string;
  categoryName:string;
  images:string[];
}
const preferredCodes=[
 'AT-E010','AT-E025','AT-E060','AT-E080','AT-E120','AT-E140',
 'AT-E170','AT-E210','AT-E260','AT-E280','AT-E035','AT-E190'
];
function record(value:unknown):Record<string,unknown>|null {
 return value!==null && typeof value==='object' && !Array.isArray(value)
  ? value as Record<string,unknown> : null;
}
function shortText(value:unknown,max:number):string {
 return typeof value==='string'?value.slice(0,max):'';
}
/** Use a real image attached to this family, never infer one from SKU digits. */
function linkedImage(product:Record<string,unknown>):string {
 const gallery=Array.isArray(product.galleryImages)
  ? product.galleryImages.map(item=>record(item)?.url) : [];
 const candidates=[...(Array.isArray(product.images)?product.images:[]),product.image,...gallery];
 for(const candidate of candidates){
  if(typeof candidate!=='string' || candidate.length>2048)continue;
  const local=getProductImageUrl(candidate);
  if(local.startsWith('/storage/products/'))return local;
 }
 return '';
}

/** Read only from already sanitized publicCatalog; return an explicit allowlist of fields. */
export function selectHomePreviewProducts(catalog:unknown):HomePreviewProduct[] {
 if(!Array.isArray(catalog))return [];
 const active=catalog.map(record).filter((p):p is Record<string,unknown> => Boolean(p && p.active!==false && typeof p.code==='string'));
 const byCode=new Map(active.map(p=>[String(p.code).toLowerCase(),p]));
 const selected=preferredCodes.map(code=>byCode.get(code.toLowerCase())).filter((p):p is Record<string,unknown>=>Boolean(p));
 // Match the existing 12-24 fallback when the catalogue is large. When the
 // database has fewer than 24 active families, still return up to 12 products.
 const originalSelection=selected.length>=8
  ? selected
  : active.length>=24 ? active.slice(12,24) : active.slice(0,12);
 // Prefer catalog families with actual attached images, not blank cards.
 // Preserve the original ordering when the catalogue contains no photos.
 const photographic=[...originalSelection.filter(p=>linkedImage(p)),...active.filter(p=>linkedImage(p))];
 const seen=new Set<string>();
 const source=[...photographic,...originalSelection,...active].filter(p=>{
  const code=String(p.code);
  if(seen.has(code))return false;
  seen.add(code);
  return true;
 }).slice(0,12);
 return source.map(p=>{
  const image=linkedImage(p);
  return {
   code:shortText(p.code,180),
   name:shortText(p.name,240),
   brand:shortText(p.brand,140),
   categorySlug:shortText(p.categorySlug,180),
   categoryName:shortText(p.categoryName,180),
   images:image?[image]:[]
  };
 });
}
