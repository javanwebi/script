import type {Product} from '../types';
import type {CatalogImageRecord} from './catalogImageCorpus';
const normalized=(value:unknown)=>String(value || '').normalize('NFKC').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[يى]/g,'ی').replace(/ك/g,'ک').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim();
export function catalogRecognitionContext(products:Product[],observation:any){
 const byFamily=new Map(products.filter(p=>p.active!==false).map(p=>[p.code,p]));
 const read=Number(observation?.code_read_confidence)>=85 ? normalized(observation?.detected_code_on_part) : '';
 const families=[observation?.part_family_farsi,...(Array.isArray(observation?.possible_families) ? observation.possible_families.slice(0,5) : [])].map(normalized).filter(value=>value.length>=4);
 const sameText=(text:unknown)=>{const n=normalized(text);return Boolean(read && read.length>=3 && (' '+n+' ').includes(' '+read+' '));};
 const evidenceFamilies=new Set(products.filter(p=>p.active!==false && (
  sameText(p.code)||sameText(p.name)||(p.variants || []).some(v=>v.active!==false&&(sameText(v.code)||sameText(v.name)||sameText(v.model))) ||
  families.some(family=>normalized(p.name).includes(family))
 )).map(p=>p.code));
 return {
  supplement:(images:CatalogImageRecord[])=>images.filter(row=>row.bindings.some(binding=>evidenceFamilies.has(binding.familyCode))).slice(0,24),
  describe:(row:CatalogImageRecord,detail:'coarse'|'fine'='fine')=>[...new Set(row.bindings.map(b=>b.familyCode))].slice(0,3).flatMap(code=>{
   const p=byFamily.get(code);if(!p)return [];
   const variants=(p.variants || []).filter(v=>v.active!==false).sort((a,b)=>Number(sameText(b.code)||sameText(b.name))-Number(sameText(a.code)||sameText(a.name)));
   return [{family:p.name,category:p.categoryName,type:p.subcategory,specifications:(p.technicalSpecs || []).slice(0,detail==='coarse'?4:12),
    variants:variants.slice(0,detail==='coarse'?1:8).map(v=>({code:v.code,name:v.name,model:v.model,size:v.size,specifications:v.technicalSpecs}))}];
  }),
  familyNames:(row:CatalogImageRecord)=>[...new Set(row.bindings.map(b=>byFamily.get(b.familyCode)?.name).filter((name):name is string=>Boolean(name)))]
 };
}

/** Model JSON may use a string where an array was requested; never pass that into catalogue scorers. */
export function normalizeRecognitionObservation(value:any){
 const input=value?.recognition || value?.analysis || value?.result || value || {};

 const list=(value:unknown)=>Array.isArray(value) ? value.filter((entry):entry is string=>typeof entry==='string').slice(0,24) : typeof value==='string' && value.trim() ? [value] : [];
 return {...input,whatYouSee:input.whatYouSee || input.what_you_see || input.description || '',detected_part_type:input.detected_part_type || input.part_type || input.product_name || '',visual_features:list(input?.visual_features),technical_features:list(input?.technical_features),
  readable_markings:list(input?.readable_markings),unknown_parameters:list(input?.unknown_parameters),
  observed_specifications:Array.isArray(input?.observed_specifications) ? input.observed_specifications : []};
}
