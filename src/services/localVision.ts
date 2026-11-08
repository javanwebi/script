import {localModelSuggestions} from './localModelSuggestions';
import {validImageRegion} from '../utils/imageRegion';
import type {CatalogImageRecord} from './catalogImageCorpus';
import type {AiPartAnalysisResult} from './aiVisualSearchService';
import type {Product} from '../types';

// Versioned namespaces prevent mixing different embedding spaces or preprocessing.
export const LOCAL_VISION_MODEL='dinov2-small-ed25f3a3-fp32-cls-224-v1';
export const LOCAL_VISION_DIMENSIONS=384;
/** Explicit opt-in keeps existing DINO indexes readable during a staged upgrade. */
export function localVisionProfile(env:Record<string,string|undefined>=process.env){
 if(env.LOCAL_VISION_ENCODER==='mobileclip2-s0')return {model:'mobileclip2-s0-095906d2-fp32-pad-256-v1',dimensions:512,pipeline:'local-lens-v3',minSimilarity:0.55,maxViews:4};
 if(env.LOCAL_VISION_ENCODER && env.LOCAL_VISION_ENCODER!=='dinov2-small')throw new Error('Unsupported local vision encoder');
 return {model:LOCAL_VISION_MODEL,dimensions:LOCAL_VISION_DIMENSIONS,pipeline:'local-lens-v2',minSimilarity:0.65,maxViews:4};
}
async function localRequest(route:string,body:unknown,env=process.env,timeout=4500):Promise<any>{
 const endpoint=new URL(env.LOCAL_VISION_URL || 'http://sanatpish-local-vision-lens-v2:8091');
 if(!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password)throw new Error('Invalid local vision endpoint');
 const token=env.LOCAL_VISION_TOKEN;
 if(!token)throw new Error('Local vision authentication is not configured');
 const response=await fetch(new URL(route,endpoint),{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
  body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)
 });
 if(!response.ok)throw new Error(response.status===429 ? 'Local vision busy' : 'Local vision unavailable');
 const data=await response.json();
 if(data.model!==localVisionProfile(env).model)throw new Error('Local vision model/vector mismatch');
 return data;
}
function validVectors(data:any,count?:number,env=process.env){
 const profile=localVisionProfile(env);
 if(data.model!==profile.model || !Array.isArray(data.vectors) || (count!==undefined && data.vectors.length!==count) ||
  data.vectors.some((v:unknown)=>!Array.isArray(v)||v.length!==profile.dimensions||v.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw new Error('Local vision model/vector mismatch');
 return data.vectors as number[][];
}
export async function embedLocalImages(buffers:Buffer[],env=process.env):Promise<number[][]>{
 return validVectors(await localRequest('/embed',{images:buffers.map(b=>b.toString('base64'))},env),buffers.length,env);
}
export const LOCAL_VISION_PIPELINE='local-lens-v2';
type Region={x:number;y:number;width:number;height:number};
export function selectBestQueryRegion(viewRegions:(Region|null)[]|undefined,viewScores:number[],fallback?:Region|null):Region|undefined{
 let best:Region|undefined,bestScore=-Infinity;
 for(let i=0;i<(viewRegions?.length || 0);i++){
  const region=viewRegions![i],score=viewScores[i];
  if(region && Number.isFinite(score) && score>bestScore){best=region;bestScore=score;}
 }
 return best || fallback || viewRegions?.find((region):region is Region=>region!==null) || undefined;
}
export type QueryEvidence={model?:string;vectors:number[][];region?:Region|null;viewRegions?:(Region|null)[];markings:{text:string;confidence:number}[];ocrAvailable:boolean;};
export async function describeLocalQuery(image:Buffer,env=process.env):Promise<QueryEvidence>{
 const data=await localRequest('/query',{image:image.toString('base64')},env);
 const profile=localVisionProfile(env),vectors=validVectors(data,undefined,env);
 if((data.region!==null && data.region!==undefined && !validImageRegion(data.region)) || data.pipeline!==profile.pipeline || vectors.length<1 || vectors.length>profile.maxViews || !Array.isArray(data.markings))throw new Error('Invalid local query');
 if(data.viewRegions!==undefined && (!Array.isArray(data.viewRegions)||data.viewRegions.length!==vectors.length||data.viewRegions[0]!==null||data.viewRegions.some((box:any)=>box!==null&&!validImageRegion(box))))throw new Error('Invalid query regions');
 if(profile.maxViews>2&&!data.viewRegions)throw new Error('Missing query regions');
 const markings=data.markings.filter((m:any)=>typeof m.text==='string'&&m.text.length<=32&&Number.isFinite(m.confidence)&&m.confidence>=85&&m.confidence<=100).slice(0,12);
 return {model:data.model,vectors,region:data.region,viewRegions:data.viewRegions,markings,ocrAvailable:data.ocrAvailable===true};
}
export async function geometricEvidence(image:Buffer,candidates:Buffer[],env=process.env){
 const data=await localRequest('/rerank',{image:image.toString('base64'),images:candidates.map(b=>b.toString('base64'))},env,1200);
 if(data.pipeline!==localVisionProfile(env).pipeline || !Array.isArray(data.evidence) || data.evidence.length!==candidates.length || data.evidence.some((e:any)=>typeof e.supported!=='boolean'||!Number.isInteger(e.inliers)||e.inliers<0||!Number.isFinite(e.coverage)||e.coverage<0||e.coverage>1))throw new Error('Invalid geometric evidence');
 return data.evidence as {supported:boolean;inliers:number;coverage:number}[];
}
export type LocalVisualHit={row:CatalogImageRecord;score:number;visualScore?:number;viewScores?:number[];eligible?:boolean;geometry?:{supported:boolean;inliers:number;coverage:number};codeHint?:boolean;};
/** Moderate cross-domain resemblance needs distinct catalogue photographs agreeing
 * on one active family. A lone similar texture is insufficient. Never raise scores.
 */
export function bestBoundQueryViewScores(hits:LocalVisualHit[],products:Product[]):number[]{
 const families=new Set(products.filter(product=>product.active!==false).map(product=>product.code));
 const best=hits.find(hit=>hit.row.bindings.some(binding=>families.has(binding.familyCode)));
 return best?.viewScores || [];
}
export function corroborateLocalFamilies(hits:LocalVisualHit[],products:Product[],minimum:number){
 const active=new Set(products.filter(p=>p.active!==false).map(p=>p.code));
 const familyOf=(hit:LocalVisualHit)=>[...new Set(hit.row.bindings.map(b=>b.familyCode).filter(code=>active.has(code)))];
 const supporting=new Map<string,Set<string>>();
 for(const hit of hits){
  const families=familyOf(hit),score=hit.visualScore ?? hit.score;
  if(!Number.isFinite(score)||score<minimum||families.length!==1)continue;
  const photos=supporting.get(families[0]) || new Set<string>();photos.add(hit.row.url.split(/[?#]/,1)[0]);supporting.set(families[0],photos);
 }
 return hits.map(hit=>{
  const score=hit.visualScore ?? hit.score,families=familyOf(hit);
  const eligible=Number.isFinite(score)&&score>=minimum&&(score>=Math.max(0.65,minimum)||(families.length===1&&(supporting.get(families[0])?.size || 0)>=2));
  return {...hit,eligible};
 });
}
/** Similarity is a ranking signal, not a calibrated probability or identity proof. */
export function localVisionResult(hits:LocalVisualHit[],products:Product[],coverage:{total:number;indexed:number;ready:boolean},customerImageUrl:string,minSimilarity=0.65,query?:QueryEvidence,includeNearest=false):AiPartAnalysisResult {
 if(query?.model===localVisionProfile({LOCAL_VISION_ENCODER:'mobileclip2-s0'}).model)hits=corroborateLocalFamilies(hits,products,minSimilarity);
 const families=new Map(products.filter(p=>p.active!==false).map(p=>[p.code,p]));
 const familyCounts=new Map<string,number>();
 const eligible=hits.filter(hit=>hit.eligible!==false&&Number.isFinite(hit.score)&&(hit.visualScore ?? hit.score)>=minSimilarity&&hit.row.bindings.some(binding=>families.has(binding.familyCode)));
 const diversified=eligible.filter(hit=>{const key=[...new Set(hit.row.bindings.map(b=>b.familyCode).filter(code=>families.has(code)))].sort().join('|') || hit.row.id;const n=familyCounts.get(key)||0;if(n>=2)return false;familyCounts.set(key,n+1);return true;});
 const photoMatches=diversified.slice(0,8).map(({row,score})=>({
  imageId:row.id,image:row.url,label:row.label,score:Math.round(Math.max(0,Math.min(1,score))*100),
  reason:scoreReason(hits.find(h=>h.row.id===row.id)!),
  relation:'very_similar' as const,
  familyNames:[...new Set(row.bindings.flatMap(b=>families.has(b.familyCode)?[families.get(b.familyCode)!.name]:[]))],
  bindings:row.bindings.filter(b=>{const p=families.get(b.familyCode);return !!p && (!b.code || p.variants?.some(v=>v.code===b.code && v.active!==false));})
 }));
 const seen=new Set<string>();
 // The strongest candidate list keeps explicit bindings; broader, labelled models are returned separately in modelSuggestions.
 const similarCandidates:NonNullable<AiPartAnalysisResult['similarCandidates']>=photoMatches.flatMap(photo=>photo.bindings.flatMap(binding=>{
  const family=families.get(binding.familyCode),variant=family?.variants?.find(v=>v.code===binding.code && v.active!==false);
  if(!variant || seen.has(variant.code))return [];seen.add(variant.code);
  return [{code:variant.code,name:variant.name || family!.name,brand:variant.brand || family!.brand || '',type:family!.name,
   image:photo.image,similarityScore:photo.score,matchReason:photo.reason,matchType:'visual' as const,
   visualVerdict:'very_similar' as const,isVisualMatch:true,specs:variant.technicalSpecs || [],
   distinction:'کد متصل به تصویر کاتالوگ؛ یکسان‌بودن سایز و مدل با قطعه شما هنوز تأیید نشده است.'}];
 })).slice(0,12);
 // A readable code can suggest a real SKU within a visually retrieved family;
 // it is not an invented photo binding and never becomes an exact identity claim.
 for(const marking of query?.markings || []){
  const matching=[...families.values()].flatMap(family=>(family.variants || []).filter(v=>v.active!==false && normalizeCode(v.code)===normalizeCode(marking.text)).map(variant=>({family,variant})));
  if(matching.length!==1)continue;
  const {family,variant}=matching[0];
  const photo=photoMatches.find(p=>p.bindings.some(b=>b.familyCode===family.code));
  if(!photo || seen.has(variant.code))continue;seen.add(variant.code);
  similarCandidates.unshift({code:variant.code,name:variant.name || family.name,brand:variant.brand || family.brand || '',type:family.name,
   image:variant.images?.[0] || family.images?.[0] || photo.image,similarityScore:photo.score,
   matchReason:'کد خوانده‌شده از عکس با این کد کاتالوگ تطبیق دارد و خانواده نیز شباهت تصویری دارد؛ نوشته را کنترل کنید.',
   matchType:'combined',visualVerdict:'very_similar',isVisualMatch:false,specs:variant.technicalSpecs || [],
   distinction:'پیشنهاد بر پایهٔ OCR و شباهت خانواده؛ خواندن کد، اندازه و سازگاری نیاز به تأیید دارند.'});
 }
 const familyBest=new Map<string,number>();
 for(const hit of eligible)for(const binding of hit.row.bindings)familyBest.set(binding.familyCode,Math.max(familyBest.get(binding.familyCode) || -1,hit.score));
 const scores=[...familyBest.values()].sort((a,b)=>b-a);const ambiguous=scores.length>1 && scores[0]-scores[1]<0.025;
 const description=photoMatches.length?'تصاویر نزدیک به عکس شما در کاتالوگ پیدا شد. برای انتخاب دقیق، مشخصات و کد قطعه را بررسی کنید.':'شباهت کافی برای پیشنهاد محصول پیدا نشد؛ عکس واضح‌تر از قطعه و نوشتهٔ روی آن ارسال کنید.';
 const nearest=includeNearest&&!photoMatches.length ? nearestLocalSuggestions(hits,products) : undefined;
 return {success:true,isAiGenerated:true,stage:'quick',model:query?.model || LOCAL_VISION_MODEL,observationOnly:false,
  nearestCatalogSuggestions:nearest,
  summary:{whatYouSee:description,readableMarkings:query?.markings.map(m=>m.text),detectedPartType:ambiguous?'چند خانوادهٔ نزدیک؛ نیاز به تأیید':photoMatches[0]?.familyNames[0] || 'جست‌وجوی تصویری کاتالوگ',
   detectedProfile:'مدل و ابعاد از تصویر به‌تنهایی تأیید نشده است',visualAnalysis:description,confidence:0,exactVisualMatch:false,
   catalogAvailability:{status:photoMatches.length?'similar_in_catalog':'custom_order_available',statusFarsiTitle:photoMatches.length?'گزینه‌های مشابه تصویری':'نیاز به عکس یا اطلاعات بیشتر',statusFarsiMessage:description}},
  modelSuggestions:localModelSuggestions(hits,products,query?.markings || [],minSimilarity),
  matchedProducts:[],similarCandidates:similarCandidates.slice(0,12),catalogImageMatches:photoMatches,
  retrieval:{mode:'local-embedding',...coverage,verifiedPool:0},
  scanCoverage:{total:coverage.total,compared:coverage.indexed,failed:coverage.total-coverage.indexed,complete:coverage.ready,providerAvailable:true,failedImageIds:[]},
  technicalAdvice:'نتایج بر اساس شباهت تصویر هستند. نوشتهٔ روی قطعه و ابعاد را با مشخصات ثبت‌شده مقایسه کنید.',
  catalogSearchWarning:[ambiguous?'چند خانواده امتیاز نزدیک دارند؛ عکس واضح‌تر و کد قطعه برای انتخاب لازم است.':'',query?.ocrAvailable?'نوشته‌ها به‌صورت محلی خوانده شده‌اند و ممکن است خطا داشته باشند.':'خواندن نوشته در این درخواست کامل نشد.', 'امتیاز شباهت، درصد اطمینان یا تأیید سازگاری فنی نیست.'].filter(Boolean).join(' '),customerImageUrl};
}

/** Browsable nearest neighbours, explicitly outside the accepted match lists. */
export function nearestLocalSuggestions(hits:LocalVisualHit[],products:Product[]){
 const ordered=hits.filter(h=>Number.isFinite(h.score)).sort((a,b)=>b.score-a.score);
 const familyScores=new Map<string,number>();
 for(const hit of ordered)for(const b of hit.row.bindings)if(!familyScores.has(b.familyCode))familyScores.set(b.familyCode,hit.score);
 return localModelSuggestions(ordered.map(h=>({...h,eligible:true})),products,[],-1,24)
  .sort((a,b)=>(familyScores.get(b.familyCode) ?? -1)-(familyScores.get(a.familyCode) ?? -1))
  .map(item=>({...item,matchBasis:'explore' as const,visualScore:undefined,reason:'از نزدیک‌ترین گزینه‌های کاتالوگ برای بررسی شماست؛ تشخیص نوع قطعه، مدل، سایز و سازگاری تأیید نشده است.'}));
}

function scoreReason(hit:LocalVisualHit){
 return [hit.geometry?.supported?'هم‌ترازی جزئیات تصویر نیز مشاهده شد.':'شباهت ویژگی‌های تصویری.',hit.codeHint?'نوشتهٔ خوانده‌شده با یکی از کدهای ثبت‌شدهٔ این خانواده تطبیق دارد.':'', 'مدل، ابعاد و سازگاری فنی هنوز تأیید نشده است.'].filter(Boolean).join(' ');
}
const normalizeCode=(text:string)=>text.toUpperCase().replace(/[^A-Z0-9]/g,'');
export function rankLocalEvidence(hits:LocalVisualHit[],products:Product[],markings:QueryEvidence['markings']){
 const codeFamilies=new Map<string,Set<string>>();
 for(const p of products.filter(p=>p.active!==false))for(const v of p.variants || [])if(v.active!==false){const code=normalizeCode(v.code);const owners=codeFamilies.get(code)||new Set<string>();owners.add(p.code);codeFamilies.set(code,owners);}
 const families=new Set(markings.filter(m=>m.confidence>=85).flatMap(m=>{const owners=codeFamilies.get(normalizeCode(m.text));return owners?.size===1?[...owners]:[];}));
 return hits.map(hit=>{const codeHint=hit.row.bindings.some(b=>families.has(b.familyCode));return {...hit,visualScore:hit.score,codeHint,score:Math.min(0.999,hit.score+(hit.geometry?.supported?0.06:0)+(codeHint?0.04:0))};}).sort((a,b)=>b.score-a.score || a.row.id.localeCompare(b.row.id));
}
