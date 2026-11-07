import type {Product,ProductVariant} from '../types';
import type {CatalogImageRecord} from './catalogImageCorpus';
import type {CatalogModelSuggestion} from './aiVisualSearchService';
import {getProductImageUrl} from '../assets/imagesproducts';

type Hit={row:CatalogImageRecord;score:number;visualScore?:number;eligible?:boolean};
type Ranked={item:CatalogModelSuggestion;score:number};
const codeKey=(code:string)=>code.toUpperCase().replace(/[^A-Z0-9]/g,'');
const usable=(value:string|undefined)=>value && !/^(blob:|data:)/i.test(value)?getProductImageUrl(value):'';
const ownImage=(family:Product,variant:ProductVariant)=>
 (family.galleryImages || []).filter(image=>image.scope==='variant'&&image.variantCode===variant.code).map(image=>usable(image.url)).find(Boolean) ||
 (variant.images || []).map(usable).find(Boolean) || '';
const familyImage=(family:Product)=>
 (family.galleryImages || []).filter(image=>image.scope==='family').map(image=>usable(image.url)).find(Boolean) ||
 (family.images || []).map(usable).find(Boolean) || '';

/** Multiple real models, strongest independent image evidence first.
 * Family-only alternatives deliberately have no per-SKU visual similarity score.
 */
export function localModelSuggestions(hits:Hit[],products:Product[],markings:{text:string;confidence:number}[]=[],minSimilarity=0.65,limit=24):CatalogModelSuggestion[]{
 const families=new Map(products.filter(p=>p.active!==false).map(p=>[p.code,p]));
 const variants=new Map<string,{family:Product;variant:ProductVariant}>();
 for(const family of families.values())for(const variant of family.variants || [])if(variant.active!==false && variant.code?.trim())variants.set(variant.code,{family,variant});
 const eligible=hits.filter(hit=>hit.eligible!==false&&Number.isFinite(hit.score)&&(hit.visualScore ?? hit.score)>=minSimilarity).sort((a,b)=>b.score-a.score || a.row.id.localeCompare(b.row.id));
 // A lower-scoring photo may order a related model without promoting it to a
 // visual match. Unscored/shared-photo siblings remain explicitly unranked.
 const relatedPhotoScores=new Map<string,number>();
 for(const hit of hits){
  if(!Number.isFinite(hit.score))continue;
  const owners=[...new Set(hit.row.bindings.flatMap(b=>b.code&&variants.get(b.code)?.family.code===b.familyCode?[b.code]:[]))];
  if(owners.length===1)relatedPhotoScores.set(owners[0],Math.max(relatedPhotoScores.get(owners[0]) ?? -Infinity,hit.score));
 }
 const bestFamily=new Map<string,{score:number;image:string}>();
 const cards=new Map<string,Ranked>();
 const make=(family:Product,variant:ProductVariant,image:string,imageScope:CatalogModelSuggestion['imageScope'],matchBasis:CatalogModelSuggestion['matchBasis'],reason:string):CatalogModelSuggestion=>({
  code:variant.code,name:variant.name || family.name,familyCode:family.code,familyName:family.name,
  model:variant.model,size:variant.size,brand:variant.brand || family.brand,image:image || undefined,imageScope,matchBasis,reason,
  specs:(variant.technicalSpecs || []).slice(0,6)
 });
 const priority=(item:CatalogModelSuggestion)=>item.matchBasis==='visual'?0:item.matchBasis==='read_code'?1:2;
 const put=(item:CatalogModelSuggestion,score:number)=>{
  const previous=cards.get(item.code);
  if(!previous || priority(item)<priority(previous.item) || (priority(item)===priority(previous.item)&&score>previous.score))cards.set(item.code,{item,score});
 };
 for(const hit of eligible){
  const bindings=hit.row.bindings.filter(b=>families.has(b.familyCode));
  const owners=new Set(bindings.flatMap(b=>b.code&&variants.get(b.code)?.family.code===b.familyCode?[b.code]:[]));
  for(const binding of bindings){
   const family=families.get(binding.familyCode)!;
   if(!bestFamily.has(family.code))bestFamily.set(family.code,{score:hit.score,image:!binding.code?hit.row.url:familyImage(family)});
   else if(!bestFamily.get(family.code)!.image && !binding.code)bestFamily.get(family.code)!.image=hit.row.url;
   const owner=binding.code?variants.get(binding.code):undefined;
   if(!owner || owner.family.code!==family.code)continue;
   const independent=owners.size===1;
   const item=make(family,owner.variant,hit.row.url,independent?'variant':'family',independent?'visual':'family',independent?
    'عکس متصل به این مدل با تصویر شما مقایسه شده است؛ مشخصات فنی را کنترل کنید.':
    'این عکس بین چند کد مشترک است؛ شباهت مستقل این مدل و سایز تأیید نشده است.');
   if(independent)item.visualScore=Math.round(Math.max(0,Math.min(1,hit.score))*100);
   put(item,hit.score);
  }
 }
 // OCR can suggest a real unique code, but does not fabricate a photo binding.
 for(const marking of markings.filter(m=>m.confidence>=85)){
  const matches=[...variants.values()].filter(({variant})=>codeKey(variant.code)===codeKey(marking.text));
  if(matches.length!==1)continue;
  const {family,variant}=matches[0],evidence=bestFamily.get(family.code);
  if(!evidence)continue;
  const own=ownImage(family,variant);
  put(make(family,variant,own || evidence.image,own?'variant':evidence.image?'family':'none','read_code',
   'کد خوانده‌شده به این محصول اشاره دارد؛ نوشته و مشخصات را پیش از انتخاب کنترل کنید.'),evidence.score);
 }
 // Existing siblings without their own scored photograph are available for comparison,
 // with an explicit family-example image, never a copied similarity percentage.
 const familyOrder=[...bestFamily.entries()].sort((a,b)=>b[1].score-a[1].score || a[0].localeCompare(b[0]));
 const topScore=familyOrder[0]?.[1].score ?? 0;
 const relevant=familyOrder.filter(([,e])=>e.score>=topScore-0.12).slice(0,4);
 for(const [code,evidence] of relevant){
  const family=families.get(code)!;
  for(const variant of family.variants || []){
   if(variant.active===false || !variant.code?.trim() || cards.has(variant.code))continue;
   const own=ownImage(family,variant);
   put(make(family,variant,own || evidence.image,own?'variant':evidence.image?'family':'none','family',
    own?'مدل ثبت‌شده در خانوادهٔ نزدیک برای مقایسه؛ شباهت تصویری مستقل آن تأیید نشده است.':
    'مدل ثبت‌شده در خانوادهٔ نزدیک؛ عکس نمونهٔ خانواده است و شباهت مستقل این مدل بررسی نشده است.'),relatedPhotoScores.get(variant.code) ?? evidence.score-2);
  }
 }
 const ranked=[...cards.values()].sort((a,b)=>priority(a.item)-priority(b.item) || b.score-a.score || a.item.code.localeCompare(b.item.code));
 const confirmed=ranked.filter(row=>row.item.matchBasis!=='family').slice(0,limit);
 const queues=new Map<string,Ranked[]>();
 for(const row of ranked.filter(row=>row.item.matchBasis==='family')){const queue=queues.get(row.item.familyCode)||[];queue.push(row);queues.set(row.item.familyCode,queue);}
 const result=confirmed.map(row=>row.item);
 // Round robin only among unranked family alternatives; visual results keep strict order.
 while(result.length<limit){let added=false;for(const queue of queues.values()){
  const next=queue.shift();if(next){result.push(next.item);added=true;}if(result.length===limit)break;
 }if(!added)break;}
 return result;
}
