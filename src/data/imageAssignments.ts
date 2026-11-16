import type { Product } from '../types';

export function imageFileName(url: string): string {
  try {
    const decoded=decodeURIComponent(url);
    let path=decoded;
    if (/^https?:\\/\\//i.test(decoded)) {
      const parsed=new URL(decoded);
      const official=(parsed.origin==='https://raw.githubusercontent.com' && parsed.pathname.startsWith('/javanweb/imagesatlas/main/')) ||
        (parsed.origin==='https://cdn.jsdelivr.net' && parsed.pathname.startsWith('/gh/javanweb/imagesatlas@main/'));
      const ownStorage=['sanatpish.com','www.sanatpish.com'].includes(parsed.hostname.toLowerCase()) &&
        /^\\/storage\\/(products|categories)\\//i.test(parsed.pathname);
      if(!official&&!ownStorage)return '';
      path=parsed.pathname;
    }
    const cleanPath=path.split(/[?#]/,1)[0];
    if(cleanPath.includes('..'))return '';
    const legacy=cleanPath.match(/e\\((\\d+)\\)\\.png$/i);
    if(legacy)return `e(${Number(legacy[1])}).png`;
    if(/^\\/storage\\/(products|categories)\\//i.test(cleanPath)){
      const filename=cleanPath.split('/').pop()||'';
      return /^[A-Za-z0-9_.()-]+\\.(?:png|jpe?g|webp)$/i.test(filename)?filename:'';
    }
    return /^e\\(\\d+\\)\\.png$/i.test(cleanPath)?cleanPath:'';
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
export interface DbDirectSkuImageBinding {
  skuCode: string;
  name?: string;
  imageUrl?: string|null;
  categorySlug?: string;
  categoryName?: string;
  submenu?: string;
  subcategory?: string;
  sourceFamilyCode?: string|null;
  active?: boolean;
}
/** Source records are loaded from PostgreSQL by the authenticated admin endpoint, never from bundled JSON. */
export function getImageAssignmentAudit(
  products: Product[],
  records: DbImageAuditRow[],
  directSkus: DbDirectSkuImageBinding[] = [],
) {
  const recordsByFile=new Map<string,DbImageAuditRow>(records.map(item=>[item.file,item]));
  const imageUrlsByFile=new Map<string,string>();
  const rememberImage=(url:string,observed:string,reason:string)=>{
    const file=imageFileName(url);if(!file)return;
    if(!imageUrlsByFile.has(file))imageUrlsByFile.set(file,url);
    if(!recordsByFile.has(file))recordsByFile.set(file,{file,sha256:'',observed,reason});
  };
  for(const family of products){
    const gallery=family.galleryImages?.length ? family.galleryImages : (family.images||[]).map(url=>({url,scope:'family' as const,variantCode:undefined}));
    for(const image of gallery)rememberImage(image.url,image.title||`تصویر خانواده ${family.name}`,'تصویر ذخیره‌شده در گالری کاتالوگ');
    for(const variant of family.variants||[])for(const url of variant.images||[])
      rememberImage(url,`تصویر کد ${variant.code}`,'تصویر اختصاصی ذخیره‌شده برای کد کالا');
  }
  for(const direct of directSkus){
    if(direct.active===false)continue;
    rememberImage(direct.imageUrl||'',direct.name||`تصویر کد ${direct.skuCode}`,'تصویر ذخیره‌شده برای کد مستقیم');
  }

  const bindings=new Map<string,{family:Product; codes:string[]}[]>();
  for(const family of products){
    const gallery=family.galleryImages?.length ? family.galleryImages : (family.images||[]).map(url=>({url,scope:'family' as const,variantCode:undefined}));
    for(const image of gallery){
      const file=imageFileName(image.url);if(!file)continue;
      const list=bindings.get(file)||[];
      let binding=list.find(x=>x.family.code===family.code);
      if(!binding){binding={family,codes:[]};list.push(binding);}
      if(image.scope==='variant'&&image.variantCode&&family.variants?.some(v=>v.code===image.variantCode))binding.codes.push(image.variantCode);
      bindings.set(file,list);
    }
    for(const variant of family.variants||[])for(const url of variant.images||[]){
      const file=imageFileName(url);if(!file)continue;
      const list=bindings.get(file)||[];
      let binding=list.find(x=>x.family.code===family.code);
      if(!binding){binding={family,codes:[]};list.push(binding);}
      binding.codes.push(variant.code);bindings.set(file,list);
    }
  }
  const directBindings=new Map<string,DbDirectSkuImageBinding[]>();
  for(const direct of directSkus){
    if(direct.active===false)continue;
    const file=imageFileName(direct.imageUrl||'');if(!file)continue;
    const list=directBindings.get(file)||[];
    if(!list.some(existing=>existing.skuCode===direct.skuCode))list.push(direct);
    directBindings.set(file,list);
  }
  const allRecords=[...recordsByFile.values()];
  const duplicates=new Map<string,string[]>();
  for(const item of allRecords){if(!item.sha256)continue;const files=duplicates.get(item.sha256)||[];files.push(item.file);duplicates.set(item.sha256,files);}
  return allRecords.map(item=>{
    const linked=(bindings.get(item.file)||[]).map(x=>({...x,codes:[...new Set(x.codes)]}));
    const direct=(directBindings.get(item.file)||[]);
    const codeCount=linked.reduce((n,x)=>n+x.codes.length,0)+direct.length;
    const ownerCatalogue=item.ownerCatalogue;
    const research=item.research;
    return {file:item.file,imageUrl:imageUrlsByFile.get(item.file),observed:ownerCatalogue?.catalogueGroup||item.observed,reason:item.reason,sha256:item.sha256,
      research:research&&ownerCatalogue?{...research,visualType:ownerCatalogue.catalogueGroup}:research,
      ownerCatalogue,
      status:codeCount ? 'sku-linked' as const : linked.length ? 'family-example' as const : 'unassigned' as const,
      families:linked.map(({family,codes})=>({code:family.code,name:family.name,category:family.categoryName,
        skus:codes.map(code=>family.variants!.find(v=>v.code===code)!),candidateSkuCount:family.variants?.length||0})),
      directSkus:direct,
      duplicateFiles:(duplicates.get(item.sha256)||[]).filter(file=>file!==item.file),
      requiresCodeEvidence:codeCount===0,
    };
  });
}
