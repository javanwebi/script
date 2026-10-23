import type { Product } from '../types';

export function imageFileName(url: string): string {
  try {
    const decoded=decodeURIComponent(url);
    if (/^https?:\/\//i.test(decoded)) {
      const parsed=new URL(decoded);
      const official=(parsed.origin==='https://raw.githubusercontent.com' && parsed.pathname.startsWith('/javanweb/imagesatlas/main/')) || (parsed.origin==='https://cdn.jsdelivr.net' && parsed.pathname.startsWith('/gh/javanweb/imagesatlas@main/'));
      if(!official)return '';
    } else if(!/^e\(\d+\)\.png$/i.test(decoded)) return '';
    const match=decoded.match(/e\((\d+)\)\.png(?:$|[?#])/i);
    return match ? `e(${Number(match[1])}).png` : '';
  } catch { return ''; }
}
export interface DbImageAuditRow {
  file: string;
  sha256: string;
  observed: string;
  reason: string;
  research?: {
    visualType: string;
    visibleFeatures: string;
    requiredChecks: string[];
    sourceSha256?: string;
    exactSku?: string|null;
    standardStatus?: string;
  };
  ownerCatalogue?: {
    catalogueGroup: string;
    page: number;
    pdfPage: number;
    matchRatio: number;
  };
}
/** Source records are loaded from PostgreSQL by the authenticated admin endpoint, never from bundled JSON. */
export function getImageAssignmentAudit(products: Product[], records: DbImageAuditRow[]) {
  const bindings=new Map<string,{family:Product; codes:string[]}[]>();
  for(const family of products) {
    const gallery=family.galleryImages?.length ? family.galleryImages : (family.images||[]).map(url=>({url,scope:'family' as const,variantCode:undefined}));
    for(const image of gallery) {
      const file=imageFileName(image.url); if(!file) continue;
      const list=bindings.get(file)||[];
      let binding=list.find(x=>x.family.code===family.code);
      if(!binding){binding={family,codes:[]};list.push(binding);}
      if(image.scope==='variant' && image.variantCode && family.variants?.some(v=>v.code===image.variantCode)) binding.codes.push(image.variantCode);
      bindings.set(file,list);
    }
    for(const variant of family.variants||[]) for(const url of variant.images||[]) {
      const file=imageFileName(url); if(!file)continue;
      const list=bindings.get(file)||[];
      let binding=list.find(x=>x.family.code===family.code);
      if(!binding){binding={family,codes:[]};list.push(binding);}
      binding.codes.push(variant.code);bindings.set(file,list);
    }
  }
  const duplicates=new Map<string,string[]>();
  for(const item of records){if(!item.sha256)continue;const files=duplicates.get(item.sha256)||[];files.push(item.file);duplicates.set(item.sha256,files);}
  return records.map(item=>{
    const linked=(bindings.get(item.file)||[]).map(x=>({...x,codes:[...new Set(x.codes)]}));
    const codeCount=linked.reduce((n,x)=>n+x.codes.length,0);
    const ownerCatalogue=item.ownerCatalogue;
    const research=item.research;
    return {file:item.file,observed:ownerCatalogue?.catalogueGroup||item.observed,reason:item.reason,sha256:item.sha256,
      research:research&&ownerCatalogue?{...research,visualType:ownerCatalogue.catalogueGroup}:research,
      ownerCatalogue,
      status:codeCount ? 'sku-linked' as const : linked.length ? 'family-example' as const : 'unassigned' as const,
      families:linked.map(({family,codes})=>({code:family.code,name:family.name,category:family.categoryName,
        skus:codes.map(code=>family.variants!.find(v=>v.code===code)!),candidateSkuCount:family.variants?.length||0})),
      duplicateFiles:(duplicates.get(item.sha256)||[]).filter(file=>file!==item.file),
      // A singleton family still does NOT prove that the photograph is that SKU.
      requiresCodeEvidence:codeCount===0,
    };
  });
}
