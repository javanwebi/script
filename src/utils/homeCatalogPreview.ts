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
/** Read only from already sanitized publicCatalog; return an explicit allowlist of fields. */
export function selectHomePreviewProducts(catalog:unknown):HomePreviewProduct[] {
 if(!Array.isArray(catalog))return [];
 const active=catalog.map(record).filter((p):p is Record<string,unknown> => Boolean(p && p.active!==false && typeof p.code==='string'));
 const byCode=new Map(active.map(p=>[String(p.code).toLowerCase(),p]));
 const selected=preferredCodes.map(code=>byCode.get(code.toLowerCase())).filter((p):p is Record<string,unknown>=>Boolean(p));
 // Match the existing 12-24 fallback when the catalogue is large. When the
 // database has fewer than 24 active families, still return up to 12 products.
 const source=selected.length>=8
  ? selected
  : active.length>=24 ? active.slice(12,24) : active.slice(0,12);
 return source.slice(0,12).map(p=>{
  const image=Array.isArray(p.images)?p.images.find(v=>typeof v==='string' && v.length<=2048):undefined;
  return {
   code:shortText(p.code,180),
   name:shortText(p.name,240),
   brand:shortText(p.brand,140),
   categorySlug:shortText(p.categorySlug,180),
   categoryName:shortText(p.categoryName,180),
   images:typeof image==='string'?[image]:[]
  };
 });
}
