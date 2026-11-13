import type { Product } from '../types';

export function imageFileName(url: string): string {
  try {
    const decoded=decodeURIComponent(url);
    if (/^https?:\/\//i.test(decoded)) {
      const parsed=new URL(decoded);
      const official=(parsed.origin==='https://raw.githubusercontent.com' && parsed.pathname.startsWith('/javanweb/imagesatlas/main/')) || (parsed.origin==='https://cdn.jsdelivr.net' && parsed.pathname.startsWith('/gh/javanweb/imagesatlas@main/'));
      if(!official)return '';
    } else if(!/^e\(\d+\)\.png$/i.test(decoded) && !/^\/storage\/products\/catalog\/e\(\d+\)\.png$/i.test(decoded)) return '';
    const match=decoded.match(/e\((\d+)\)\.png(?:$|[?#])/i);
    return match ? `e(${Number(match[1])}).png` : '';
  } catch { return ''; }
}
export interface DbImageBindingRow {
  familyCode: string;
  familyName?: string;
  categoryName?: string;
  skuCode?: string|null;
  skuName?: string|null;
}
export interface DbImageAuditRow {
  /** Live associations queried from PostgreSQL; [] is authoritative when present. */
  bindings?: DbImageBindingRow[];
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
  const legacyBindings=new Map<string,{family:Product;codes:string[]}[]>();
  const productsByCode=new Map(products.map(product=>[product.code,product]));
  for(const family of products) {
    const gallery=family.galleryImages?.length ? family.galleryImages : (family.images||[]).map(url=>({url,scope:'family' as const,variantCode:undefined}));
    for(const image of gallery) {
      const file=imageFileName(image.url); if(!file) continue;
      const list=legacyBindings.get(file)||[];
      let binding=list.find(x=>x.family.code===family.code);
      if(!binding){binding={family,codes:[]};list.push(binding);}
      if(image.scope==='variant' && image.variantCode && family.variants?.some(v=>v.code===image.variantCode)) binding.codes.push(image.variantCode);
      legacyBindings.set(file,list);
    }
    for(const variant of family.variants||[]) for(const url of variant.images||[]) {
      const file=imageFileName(url); if(!file)continue;
      const list=legacyBindings.get(file)||[];
      let binding=list.find(x=>x.family.code===family.code);
      if(!binding){binding={family,codes:[]};list.push(binding);}
      binding.codes.push(variant.code);legacyBindings.set(file,list);
    }
  }
  const duplicates=new Map<string,string[]>();
  for(const item of records){if(!item.sha256)continue;const files=duplicates.get(item.sha256)||[];files.push(item.file);duplicates.set(item.sha256,files);}
  return records.map(item=>{
    // PostgreSQL is the authority for assignment state. The product snapshot is
    // retained only for older fixtures/responses that predate the bindings field.
    const linked=item.bindings!==undefined
      ? (() => {
          const grouped=new Map<string,{family:Product;codes:string[]}>();
          for(const binding of item.bindings||[]){
            if(!binding.familyCode)continue;
            let entry=grouped.get(binding.familyCode);
            if(!entry){
              const product=productsByCode.get(binding.familyCode);
              entry={family:product||({
                code:binding.familyCode,
                name:binding.familyName||binding.familyCode,
                categoryName:binding.categoryName||'',
                variants:[]
              } as unknown as Product),codes:[]};
              grouped.set(binding.familyCode,entry);
            }
            if(binding.skuCode)entry.codes.push(binding.skuCode);
          }
          return Array.from(grouped.values()).map(entry=>({
            ...entry,
            codes:[...new Set(entry.codes)]
          }));
        })()
      : (legacyBindings.get(item.file)||[]).map(entry=>({...entry,codes:[...new Set(entry.codes)]}));
    const codeCount=linked.reduce((n,x)=>n+x.codes.length,0);
    const ownerCatalogue=item.ownerCatalogue;
    const research=item.research;
    return {file:item.file,observed:ownerCatalogue?.catalogueGroup||item.observed,reason:item.reason,sha256:item.sha256,
      research:research&&ownerCatalogue?{...research,visualType:ownerCatalogue.catalogueGroup}:research,
      ownerCatalogue,
      status:codeCount ? 'sku-linked' as const : linked.length ? 'family-example' as const : 'unassigned' as const,
      families:linked.map(({family,codes})=>({code:family.code,name:family.name,category:family.categoryName,
        skus:codes.map(code=>family.variants?.find(v=>v.code===code) || ({code,name:item.bindings?.find(binding=>binding.familyCode===family.code&&binding.skuCode===code)?.skuName||code} as Product['variants'][number])),
        candidateSkuCount:family.variants?.length||0})),
      duplicateFiles:(duplicates.get(item.sha256)||[]).filter(file=>file!==item.file),
      requiresCodeEvidence:codeCount===0,
    };
  });
}
