import type {Product,ProductVariant} from '../types';
import type {CatalogImageRecord} from './catalogImageCorpus';
import type {CatalogModelSuggestion} from './aiVisualSearchService';
import {getProductImageUrl} from '../assets/imagesproducts';

type Hit={row:CatalogImageRecord;score:number;visualScore?:number;eligible?:boolean};
type Ranked={item:CatalogModelSuggestion;score:number;tieScore:number};
const codeKey=(code:string)=>code.toUpperCase().replace(/[^A-Z0-9]/g,'');
const usable=(value:string|undefined)=>value && !/^(blob:|data:)/i.test(value)?getProductImageUrl(value):'';
const ownImage=(family:Product,variant:ProductVariant)=>
 (family.galleryImages || []).filter(image=>image.scope==='variant'&&image.variantCode===variant.code).map(image=>usable(image.url)).find(Boolean) ||
 (variant.images || []).map(usable).find(Boolean) || '';
const familyImage=(family:Product)=>
 (family.galleryImages || []).filter(image=>image.scope==='family').map(image=>usable(image.url)).find(Boolean) ||
 (family.images || []).map(usable).find(Boolean) || '';

/**
 * SKU-level visual suggestions require one independently bound catalogue photo.
 * Shared family photos are represented once at family level; they never fan out
 * into several unverified sibling SKU cards.
 */
export function localModelSuggestions(hits:Hit[],products:Product[],markings:{text:string;confidence:number}[]=[],minSimilarity=0.65,limit=24):CatalogModelSuggestion[]{
 const families=new Map(products.filter(p=>p.active!==false).map(p=>[p.code,p]));
 const variants=new Map<string,{family:Product;variant:ProductVariant}>();
 for(const family of families.values())for(const variant of family.variants || [])if(variant.active!==false && variant.code?.trim())variants.set(variant.code,{family,variant});
 const eligible=hits.filter(hit=>hit.eligible!==false&&Number.isFinite(hit.score)&&(hit.visualScore ?? hit.score)>=minSimilarity)
  .sort((a,b)=>(b.visualScore ?? b.score)-(a.visualScore ?? a.score) || b.score-a.score || a.row.id.localeCompare(b.row.id));
 const bestFamily=new Map<string,{score:number;image:string}>();
 const cards=new Map<string,Ranked>();
 const make=(family:Product,variant:ProductVariant,image:string,imageScope:CatalogModelSuggestion['imageScope'],matchBasis:CatalogModelSuggestion['matchBasis'],reason:string):CatalogModelSuggestion=>({
  code:variant.code,name:variant.name || family.name,familyCode:family.code,familyName:family.name,
  model:variant.model,size:variant.size,brand:variant.brand || family.brand,image:image || undefined,imageScope,matchBasis,reason,
  specs:(variant.technicalSpecs || []).slice(0,6)
 });
 const priority=(item:CatalogModelSuggestion)=>item.matchBasis==='visual'?0:item.matchBasis==='read_code'?1:2;
 const put=(item:CatalogModelSuggestion,score:number,tieScore=score)=>{
  const key=item.code || 'family:'+item.familyCode;
  const previous=cards.get(key);
  if(!previous || priority(item)<priority(previous.item) || (priority(item)===priority(previous.item)&&(score>previous.score || (score===previous.score&&tieScore>previous.tieScore))))cards.set(key,{item,score,tieScore});
 };
 const putFamily=(family:Product,hit:Hit,visualRank:number,reason:string)=>{
  put({
   name:family.name,familyCode:family.code,familyName:family.name,brand:family.brand,
   image:hit.row.url,imageScope:'family',matchBasis:'visual',
   visualScore:Math.round(Math.max(0,Math.min(1,visualRank))*100),specs:[],reason
  },visualRank,hit.score);
  const previous=bestFamily.get(family.code);
  if(!previous || visualRank>previous.score)bestFamily.set(family.code,{score:visualRank,image:hit.row.url});
 };
 for(const hit of eligible){
  const visualRank=hit.visualScore ?? hit.score;
  const bindings=hit.row.bindings.filter(binding=>families.has(binding.familyCode));
  const ownersByFamily=new Map<string,Set<string>>();
  const allOwners=new Set<string>();
  for(const binding of bindings){
   if(!binding.code)continue;
   const owner=variants.get(binding.code);
   if(!owner || owner.family.code!==binding.familyCode)continue;
   const ownerKey=binding.familyCode+':'+binding.code;
   allOwners.add(ownerKey);
   const owners=ownersByFamily.get(binding.familyCode) || new Set<string>();
   owners.add(ownerKey);
   ownersByFamily.set(binding.familyCode,owners);
  }
  for(const binding of bindings){
   const family=families.get(binding.familyCode)!;
   const familyOwners=ownersByFamily.get(family.code) || new Set<string>();
   if(!binding.code){
    if(familyOwners.size===0 || allOwners.size>1){
     putFamily(family,hit,visualRank,familyOwners.size>1 || allOwners.size>1
      ? 'این تصویر میان چند کد یا خانواده مشترک است؛ فقط شباهت در سطح خانواده قابل ارائه است و کد SKU دقیق تأیید نشده است.'
      : 'تصویر به خانواده واقعی محصول متصل است، نه به یک کد SKU مشخص؛ مدل و سایز دقیق تأیید نشده است.');
    }else if(!bestFamily.has(family.code)){
     bestFamily.set(family.code,{score:visualRank,image:familyImage(family)});
    }
    continue;
   }
   const owner=variants.get(binding.code);
   if(!owner || owner.family.code!==family.code)continue;
   const independent=familyOwners.size===1 && allOwners.size===1;
   if(!independent){
    putFamily(family,hit,visualRank,'تصویر کاتالوگ بین چند کد مشترک است؛ این نتیجه فقط خانواده را نشان می‌دهد و مدل یا سایز مستقل تأیید نشده است.');
    continue;
   }
   const item=make(family,owner.variant,hit.row.url,'variant','visual',
    'تصویر اختصاصی متصل به این کد با عکس شما مقایسه شده است؛ ابعاد و سازگاری فنی همچنان باید کنترل شوند.');
   item.visualScore=Math.round(Math.max(0,Math.min(1,visualRank))*100);
   put(item,visualRank,hit.score);
   if(!bestFamily.has(family.code))bestFamily.set(family.code,{score:visualRank,image:familyImage(family)});
  }
 }
 // OCR may suggest a real, unique code only after its family has visual evidence.
 // It never borrows a sibling SKU photograph.
 for(const marking of markings.filter(m=>m.confidence>=85)){
  const matches=[...variants.values()].filter(({variant})=>codeKey(variant.code)===codeKey(marking.text));
  if(matches.length!==1)continue;
  const {family,variant}=matches[0],evidence=bestFamily.get(family.code);
  if(!evidence)continue;
  const own=ownImage(family,variant);
  const familyPhoto=familyImage(family);
  const image=own || familyPhoto;
  put(make(family,variant,image,own?'variant':familyPhoto?'family':'none','read_code',
   'کد خوانده‌شده به این محصول اشاره دارد و خانواده نیز شباهت تصویری دارد؛ نوشته، ابعاد و سازگاری را پیش از انتخاب کنترل کنید.'),evidence.score,evidence.score);
 }
 return [...cards.values()]
  .sort((a,b)=>priority(a.item)-priority(b.item) || b.score-a.score || b.tieScore-a.tieScore ||
    (a.item.code || a.item.familyCode).localeCompare(b.item.code || b.item.familyCode))
  .slice(0,limit)
  .map(row=>row.item);
}
