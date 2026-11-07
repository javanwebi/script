import type {CatalogImageRecord} from './catalogImageCorpus';
import type {AiPartAnalysisResult} from './aiVisualSearchService';
import type {Product} from '../types';

// Versioned namespaces prevent mixing different embedding spaces or preprocessing.
export const LOCAL_VISION_MODEL='dinov3-smallplus-c93d816f-fp32-cls-224-v1';
export const LOCAL_VISION_DIMENSIONS=384;
export async function embedLocalImages(buffers:Buffer[], env=process.env):Promise<number[][]>{
 const endpoint=new URL(env.LOCAL_VISION_URL || 'http://sanatpish-local-vision:8091');
 if(!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password)throw new Error('Invalid local vision endpoint');
 const token=env.LOCAL_VISION_TOKEN;
 if(!token)throw new Error('Local vision authentication is not configured');
 const response=await fetch(new URL('/embed',endpoint),{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
  body:JSON.stringify({images:buffers.map(buffer=>buffer.toString('base64'))}),signal:AbortSignal.timeout(4500)
 });
 if(!response.ok)throw new Error(response.status===429 ? 'Local vision busy' : 'Local vision unavailable');
 const data=await response.json();
 if(data.model!==LOCAL_VISION_MODEL || !Array.isArray(data.vectors) || data.vectors.length!==buffers.length ||
  data.vectors.some((v:unknown)=>!Array.isArray(v)||v.length!==LOCAL_VISION_DIMENSIONS||v.some(n=>typeof n!=='number'||!Number.isFinite(n))))throw new Error('Local vision model/vector mismatch');
 return data.vectors;
}
export type LocalVisualHit={row:CatalogImageRecord;score:number};
/** Similarity is a ranking signal, not a calibrated probability or identity proof. */
export function localVisionResult(hits:LocalVisualHit[],products:Product[],coverage:{total:number;indexed:number;ready:boolean},customerImageUrl:string,minSimilarity=0.65):AiPartAnalysisResult {
 const families=new Map(products.filter(p=>p.active!==false).map(p=>[p.code,p]));
 const photoMatches=hits.filter(hit=>Number.isFinite(hit.score)&&hit.score>=minSimilarity).slice(0,8).map(({row,score})=>({
  imageId:row.id,image:row.url,label:row.label,score:Math.round(Math.max(0,Math.min(1,score))*100),
  reason:'پیشنهاد بر اساس شباهت ویژگی‌های تصویر؛ مدل، ابعاد و سازگاری فنی تأیید نشده است.',
  relation:'very_similar' as const,
  familyNames:[...new Set(row.bindings.flatMap(b=>families.has(b.familyCode)?[families.get(b.familyCode)!.name]:[]))],
  bindings:row.bindings.filter(b=>{const p=families.get(b.familyCode);return !!p && (!b.code || p.variants?.some(v=>v.code===b.code && v.active!==false));})
 }));
 const seen=new Set<string>();
 // Only explicitly image-bound SKUs become product cards. Never pick an arbitrary size from a family.
 const similarCandidates=photoMatches.flatMap(photo=>photo.bindings.flatMap(binding=>{
  const family=families.get(binding.familyCode),variant=family?.variants?.find(v=>v.code===binding.code && v.active!==false);
  if(!variant || seen.has(variant.code))return [];seen.add(variant.code);
  return [{code:variant.code,name:variant.name || family!.name,brand:variant.brand || family!.brand || '',type:family!.name,
   image:photo.image,similarityScore:photo.score,matchReason:photo.reason,matchType:'visual' as const,
   visualVerdict:'very_similar' as const,isVisualMatch:true,specs:variant.technicalSpecs || [],
   distinction:'کد متصل به تصویر کاتالوگ؛ یکسان‌بودن سایز و مدل با قطعه شما هنوز تأیید نشده است.'}];
 })).slice(0,12);
 const description=photoMatches.length?'تصاویر نزدیک به عکس شما در کاتالوگ پیدا شد. برای انتخاب دقیق، مشخصات و کد قطعه را بررسی کنید.':'شباهت کافی برای پیشنهاد محصول پیدا نشد؛ عکس واضح‌تر از قطعه و نوشتهٔ روی آن ارسال کنید.';
 return {success:true,isAiGenerated:true,stage:'quick',model:LOCAL_VISION_MODEL,observationOnly:false,
  summary:{whatYouSee:description,detectedPartType:photoMatches[0]?.familyNames[0] || 'جست‌وجوی تصویری کاتالوگ',
   detectedProfile:'مدل و ابعاد از تصویر به‌تنهایی تأیید نشده است',visualAnalysis:description,confidence:0,exactVisualMatch:false,
   catalogAvailability:{status:photoMatches.length?'similar_in_catalog':'custom_order_available',statusFarsiTitle:photoMatches.length?'گزینه‌های مشابه تصویری':'نیاز به عکس یا اطلاعات بیشتر',statusFarsiMessage:description}},
  matchedProducts:[],similarCandidates,catalogImageMatches:photoMatches,
  retrieval:{mode:'local-embedding',...coverage,verifiedPool:0},
  scanCoverage:{total:coverage.total,compared:coverage.indexed,failed:coverage.total-coverage.indexed,complete:coverage.ready,providerAvailable:true,failedImageIds:[]},
  technicalAdvice:'نتایج بر اساس شباهت تصویر هستند. نوشتهٔ روی قطعه و ابعاد را با مشخصات ثبت‌شده مقایسه کنید.',
  catalogSearchWarning:'خواندن نوشته و تأیید فنی خودکار در مسیر محلی فعال نیست. امتیاز شباهت، درصد اطمینان نیست.',customerImageUrl};
}
