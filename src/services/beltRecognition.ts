import type { Product, ProductVariant } from '../types';
import type { AiPartAnalysisResult, BeltRecognitionAnalysis } from './aiVisualSearchService';
import { isIndustrialBeltProduct } from '../utils/industrialBeltScope';
type Marking={text:string;confidence:number};
type BeltKind=BeltRecognitionAnalysis['beltType'];
type ProfileEvidence={profile:string;kind:BeltKind;evidence:string;confidence:number;nominalPitchMm?:number;lengthMarking?:string;brandMarking?:string};
const PROFILE_TOKENS=new Set(['SPZ','SPA','SPB','SPC','XPZ','XPA','XPB','XPC','3V','3VX','5V','5VX','8V','8VX','ZX','AX','BX','CX','AA','BB','CC','Z','A','B','C','D','E','MXL','XL','L','H','XH','XXH','T2.5','T5','T10','T20','AT2.5','AT5','AT10','AT20','2M','3M','5M','8M','14M','20M','S5M','S8M','S14M','D5M','D8M','D14M','DS8M','PH','PJ','PK','PL','PM']);
const TIMING_PITCH_MM:Record<string,number>={MXL:2.032,XL:5.08,L:9.525,H:12.7,XH:22.225,XXH:31.75,'T2.5':2.5,T5:5,T10:10,T20:20,'AT2.5':2.5,AT5:5,AT10:10,AT20:20,'2M':2,'3M':3,'5M':5,'8M':8,'14M':14,'20M':20,S5M:5,S8M:8,S14M:14,D5M:5,D8M:8,D14M:14,DS8M:8};
const BRAND_TOKENS=['OPTIBELT','MEGADYNE','GATES','BANDO','MITSUBOSHI','CONTITECH','CONTINENTAL','HUTCHINSON','DAYCO','SWR','SKF'];
function normalizeMarking(value:unknown):string{
 const p='۰۱۲۳۴۵۶۷۸۹',a='٠١٢٣٤٥٦٧٨٩';
 return String(value??'').normalize('NFKC').replace(/[۰-۹]/g,d=>String(p.indexOf(d))).replace(/[٠-٩]/g,d=>String(a.indexOf(d))).replace(/[×✕]/g,'X').replace(/[–—]/g,'-').replace(/[\u200c\u200d\u200e\u200f]/g,' ').toUpperCase().replace(/[^A-Z0-9\u0600-\u06ff. -]+/g,' ').replace(/\s+/g,' ').trim();
}
function normalizeCode(value:unknown):string{return normalizeMarking(value).replace(/[^A-Z0-9]/g,'');}
function markingContainsCode(markingText:string,code:string):boolean{
 const expected=normalizeCode(code);
 if(!expected)return false;
 const tokens=normalizeMarking(markingText).split(/[^A-Z0-9]+/).filter(Boolean);
 for(let start=0;start<tokens.length;start++){
  let combined='';
  for(let end=start;end<tokens.length&&combined.length<expected.length;end++){
   combined+=tokens[end];
   if(combined===expected)return true;
   if(!expected.startsWith(combined))break;
  }
 }
 return false;
}
function profileKind(profile:string):BeltKind{
 if(/^(SPZ|SPA|SPB|SPC|XPZ|XPA|XPB|XPC|3V|3VX|5V|5VX|8V|8VX|ZX|AX|BX|CX|AA|BB|CC|Z|A|B|C|D|E)$/.test(profile))return 'v-belt';
 if(/^(PH|PJ|PK|PL|PM)$/.test(profile))return 'ribbed';
 return 'timing';
}
function profileInMarking(value:string):Omit<ProfileEvidence,'confidence'|'evidence'>|undefined{
 const text=normalizeMarking(value);let profile:string|undefined;
 const prefixed=text.match(/\b(?:HTD|MEGASYNC|MEGAPOWER|RPP|STD|SYNCHRO(?:NOUS)?)\s*(DS8M|D14M|D8M|D5M|S14M|S8M|S5M|2M|3M|5M|8M|14M|20M)\b/);
 if(prefixed)profile=prefixed[1];
 if(!profile){const m=text.match(/\b(DS8M|D14M|D8M|D5M|S14M|S8M|S5M|AT2\.5|AT5|AT10|AT20|T2\.5|T5|T10|T20|MXL|XXH|XH|XL)\b/);if(m)profile=m[1];}
 if(!profile){const m=text.match(/\b(H|L)\b/);if(m){const t=m[1];if(new RegExp('\\b'+t+'\\s*[-/]?\\s*\\d{2,6}\\b').test(text)||new RegExp('\\b\\d{3,6}\\s*[-/]?\\s*'+t+'\\b').test(text))profile=t;}}
 if(!profile){const m=text.match(/\b(2M|3M|5M|8M|14M|20M)\b/);if(m&&/\b\d{3,6}\b/.test(text))profile=m[1];}
 if(!profile){const m=text.match(/\b(SPZ|SPA|SPB|SPC|XPZ|XPA|XPB|XPC|3VX|5VX|8VX|3V|5V|8V|ZX|AX|BX|CX|AA|BB|CC)\b/);if(m)profile=m[1];}
 if(!profile){const m=text.match(/\b(PH|PJ|PK|PL|PM)\b/);if(m)profile=m[1];}
 if(!profile){const m=text.match(/\b([ZABCDE])\s*[-/]?\s*(\d{2,5})\b/);if(m)profile=m[1];}
 if(!profile)return undefined;
 const escaped=profile.replace('.','\\.'),length=text.match(new RegExp('\\b'+escaped+'\\s*[-/]?\\s*(\\d{2,6}(?:\\.\\d+)?)\\b'));
 const explicitLength=text.match(/\b(?:LENGTH|LEN|LI|LA|LD|LP|LW)\s*[:=]?\s*(\d{2,6}(?:\.\d+)?)\b/);
 return {profile,kind:profileKind(profile),nominalPitchMm:TIMING_PITCH_MM[profile],lengthMarking:length?.[1]||explicitLength?.[1]};
}
export function parseBeltMarkings(markings:Marking[]):ProfileEvidence|undefined{
 const usable=markings.filter(m=>typeof m.text==='string'&&m.text.trim().length>0&&Number.isFinite(m.confidence)&&m.confidence>=85).slice(0,12);
 if(!usable.length)return undefined;
 let selected:ProfileEvidence|undefined;
 for(const marking of usable){const parsed=profileInMarking(marking.text);if(parsed){selected={...parsed,confidence:marking.confidence,evidence:marking.text.trim().slice(0,80)};break;}}
 const combined=normalizeMarking(usable.map(m=>m.text).join(' '));
 const explicitPitch=combined.match(/(?:PITCH|GAM|گام)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:MM|میلی\s*متر)?/i);
 const explicitLength=combined.match(/\b(?:LENGTH|LEN|LI|LA|LD|LP|LW)\s*[:=]?\s*(\d{2,6}(?:\.\d+)?)\b/i);
 const brand=BRAND_TOKENS.find(token=>new RegExp('\\b'+token+'\\b').test(combined));
 if(!selected&&!explicitPitch&&!explicitLength&&!brand)return undefined;
 return {...(selected||{profile:'',kind:'unknown' as BeltKind,evidence:usable[0].text.trim().slice(0,80),confidence:usable[0].confidence}),nominalPitchMm:selected?.nominalPitchMm??(explicitPitch?Number(explicitPitch[1]):undefined),lengthMarking:selected?.lengthMarking||explicitLength?.[1],evidence:selected?.evidence||usable[0].text.trim().slice(0,80),confidence:selected?.confidence??usable[0].confidence,brandMarking:brand};
}
function addKnownProfiles(target:Set<string>,value:unknown):void{
 if(value===undefined||value===null)return;
 const text=normalizeMarking(value);
 for(const token of text.split(/[\s,;/|(){}]+/)){const key=token.replace(/[^A-Z0-9.]/g,'');if(PROFILE_TOKENS.has(key))target.add(key);}
 const parsed=profileInMarking(text);if(parsed?.profile)target.add(parsed.profile);
}
function catalogProfiles(product:Product):string[]{
 const found=new Set<string>();addKnownProfiles(found,product.profiles);addKnownProfiles(found,product.name);addKnownProfiles(found,product.subcategory);
 for(const spec of product.technicalSpecs||[])if(/profile|پروفیل|مقطع/i.test(String(spec.key||'')))addKnownProfiles(found,spec.value);
 for(const variant of product.variants||[]){addKnownProfiles(found,variant.identitySpecs?.profile);addKnownProfiles(found,variant.model);addKnownProfiles(found,variant.name);for(const spec of variant.technicalSpecs||[])if(/profile|پروفیل|مقطع/i.test(String(spec.key||'')))addKnownProfiles(found,spec.value);}
 return [...found];
}
function familyProfileStatus(product:Product,profile?:string):'match'|'conflict'|'unknown'{if(!profile)return 'unknown';const profiles=catalogProfiles(product);if(!profiles.length)return 'unknown';return profiles.includes(profile)?'match':'conflict';}
function beltTypeLabel(kind:BeltKind):string{if(kind==='v-belt')return 'تسمه V شکل';if(kind==='timing')return 'تسمه تایمینگ';if(kind==='ribbed')return 'تسمه چندشیاری';return 'تسمه صنعتی';}
function suggestionReason(status:'match'|'conflict'|'unknown',profile?:string):string{
 if(status==='match')return 'پروفیل '+profile+' در مارکینگ خوانده شد و با مشخصات هویتی ثبت‌شده خانواده هم‌خوان است؛ طول مرجع و سازگاری نهایی هنوز باید بررسی شوند.';
 if(status==='unknown')return 'پروفیل '+profile+' خوانده شد، اما پروفیل هویتی این خانواده در کاتالوگ ثبت نشده است؛ این گزینه فقط برای بررسی بیشتر نمایش داده می‌شود.';
 return 'پروفیل خوانده‌شده با مشخصات این خانواده هم‌خوان نیست.';
}
export function applyBeltRecognition(result:AiPartAnalysisResult,products:Product[],markings:Marking[]):AiPartAnalysisResult{
 const beltFamilies=products.filter(p=>p.active!==false&&isIndustrialBeltProduct(p)),families=new Map<string,Product>();
 for(const family of beltFamilies)families.set(family.code,family);
 const variants=new Map<string,{family:Product;variant:ProductVariant}>();
 for(const family of beltFamilies)for(const variant of family.variants||[])if(variant.active!==false&&variant.code?.trim())variants.set(variant.code,{family,variant});
 const parsed=parseBeltMarkings(markings),candidateCodes=new Set<string>();
 const addVisualFamily=(code:string)=>{if(families.has(code))candidateCodes.add(code);};
 // A family is confirmed only by evidence anchored to an eligible visual retrieval.
 // OCR-only (read_code), family-sibling, and exploratory suggestions can enrich a
 // visually anchored family, but can never establish that the photographed object is a belt.
 for(const photo of result.catalogImageMatches||[])for(const binding of photo.bindings||[])addVisualFamily(binding.familyCode);
 for(const item of result.similarCandidates||[]){
  if(item.isVisualMatch!==true)continue;
  const owner=item.code?variants.get(item.code):undefined;
  if(owner)addVisualFamily(owner.family.code);
 }
 for(const item of result.modelSuggestions||[])if(item.matchBasis==='visual')addVisualFamily(item.familyCode);
 const hasVisualBeltEvidence=candidateCodes.size>0;
 const statuses=new Map<string,'match'|'conflict'|'unknown'>();
 for(const code of candidateCodes){const family=families.get(code);if(family)statuses.set(code,familyProfileStatus(family,parsed?.profile));}
 const allowedCodes=new Set([...statuses.entries()].filter(([,status])=>status!=='conflict').map(([code])=>code));
 const candidateMarkings=markings.filter(m=>Number.isFinite(m.confidence)&&m.confidence>=85),codeMatches=new Set<string>();
 for(const marking of candidateMarkings){
  const owners=[...variants.entries()].filter(([,entry])=>markingContainsCode(marking.text,entry.variant.code));
  if(owners.length===1&&allowedCodes.has(owners[0][1].family.code))codeMatches.add(owners[0][1].variant.code);
 }
 const familyOrder=(code:string)=>statuses.get(code)==='match'?0:1;
 const modelSuggestions=(result.modelSuggestions||[]).filter(item=>allowedCodes.has(item.familyCode)).map(item=>{
  const status=statuses.get(item.familyCode)||'unknown',note=parsed?.profile?suggestionReason(status,parsed.profile):'فقط شباهت تصویری خانواده بررسی شده است؛ پروفیل و سازگاری فنی تأیید نشده‌اند.';
  return {...item,reason:item.reason+' '+note};
 }).sort((a,b)=>familyOrder(a.familyCode)-familyOrder(b.familyCode)||(a.matchBasis==='read_code'?-1:0)-(b.matchBasis==='read_code'?-1:0));
 const matchedProducts=(result.matchedProducts||[]).filter(item=>{
  const owner=variants.get(item.code);
  return Boolean(owner&&allowedCodes.has(owner.family.code));
 });
 const familyByVariant=new Map<string,string>();for(const [code,owner] of variants)familyByVariant.set(code,owner.family.code);
 const similarCandidates=(result.similarCandidates||[]).filter(item=>item.isVisualMatch===true&&Boolean(item.code&&allowedCodes.has(familyByVariant.get(item.code)||''))).map(item=>{
  const family=families.get(familyByVariant.get(item.code!)!)!,status=statuses.get(family.code)||'unknown',note=parsed?.profile?suggestionReason(status,parsed.profile):'این گزینه فقط از نظر تصویر به خانواده نزدیک است؛ پروفیل و سازگاری فنی تأیید نشده‌اند.';
  return {...item,matchReason:item.matchReason+' '+note};
 }).sort((a,b)=>familyOrder(familyByVariant.get(a.code)||'')-familyOrder(familyByVariant.get(b.code)||''));
 const catalogImageMatches=(result.catalogImageMatches||[]).flatMap(photo=>{
  const bindings=(photo.bindings||[]).filter(binding=>allowedCodes.has(binding.familyCode));if(!bindings.length)return [];
  return [{...photo,bindings,familyNames:[...new Set(bindings.map(binding=>families.get(binding.familyCode)?.name).filter((name):name is string=>Boolean(name)))]}];
 });
 const nearestCatalogSuggestions=(result.nearestCatalogSuggestions||[]).filter(item=>allowedCodes.has(item.familyCode)),visibleFamilyCodes=new Set<string>();
 for(const item of modelSuggestions)visibleFamilyCodes.add(item.familyCode);
 for(const photo of catalogImageMatches)for(const binding of photo.bindings)visibleFamilyCodes.add(binding.familyCode);
 for(const item of similarCandidates){const code=familyByVariant.get(item.code);if(code)visibleFamilyCodes.add(code);}
 for(const item of nearestCatalogSuggestions)visibleFamilyCodes.add(item.familyCode);
 const candidateFamilies=[...visibleFamilyCodes].map(code=>families.get(code)).filter((family):family is Product=>Boolean(family)).sort((a,b)=>familyOrder(a.code)-familyOrder(b.code)).slice(0,6).map(family=>{
  const status=statuses.get(family.code)||'unknown',readCode=[...codeMatches].some(code=>variants.get(code)?.family.code===family.code),profiles=catalogProfiles(family);
  return {familyCode:family.code,familyName:family.name,profile:profiles.join(' / ')||undefined,sizesSummary:family.sizesSummary||undefined,basis:readCode?'read-code' as const:status==='match'?'profile' as const:'visual-family' as const};
 });
 const profileMatchStatus:BeltRecognitionAnalysis['profileMatchStatus']=!parsed?.profile?'not-read':!hasVisualBeltEvidence?'unverified':candidateFamilies.some(item=>statuses.get(item.familyCode)==='match')?'matched':candidateFamilies.some(item=>statuses.get(item.familyCode)==='unknown')?'unverified':'not-matched';
 const codeList=[...codeMatches].slice(0,6),evidence=[...(parsed?.evidence?['مارکینگ خوانده‌شده: '+parsed.evidence]:[]),...(parsed?.profile?['پروفیل استخراج‌شده: '+parsed.profile]:[]),...(codeList.length?['کدهای یکتای متصل به خانواده تصویری: '+codeList.join('، ')]:[])];
 const note=!hasVisualBeltEvidence?(parsed?.profile?'مارکینگ '+parsed.profile+' خوانده شد، اما تصویر به خانواده‌های تسمه شباهت کافی نشان نداد؛ برای جلوگیری از پیشنهاد اشتباه، نوع تسمه تأیید نمی‌شود.':'تصویر به خانواده‌های تسمه شباهت کافی نشان نداد؛ ابتدا باید تسمه بودن قطعه از روی تصویر تأیید شود.') : profileMatchStatus==='matched'?'پروفیل خوانده‌شده با اطلاعات هویتی حداقل یک خانواده تصویری تسمه هم‌خوان است. این تطبیق هنوز طول مرجع، تعداد دندانه، عرض، جنس و سازگاری با دستگاه را تأیید نمی‌کند.':profileMatchStatus==='unverified'?'پروفیل از مارکینگ استخراج شد، اما اطلاعات هویتی خانواده‌های نزدیک برای تأیید یا رد آن کامل نیست؛ بررسی مهندسی لازم است.':profileMatchStatus==='not-matched'?'پروفیل خوانده‌شده با پروفیل‌های ثبت‌شده خانواده‌های تصویری هم‌خوان نیست؛ نامزدهای متناقض از پیشنهادهای اصلی حذف شدند.':candidateFamilies.length?'خانواده‌های تسمه از نظر تصویر نزدیک‌اند، اما مارکینگ خوانا برای تأیید پروفیل در دسترس نیست.':'در این تصویر، خانواده تسمه با شواهد کافی در کاتالوگ پیدا نشد. تصویر واضح‌تر از سطح نوشته‌دار یا کد فنی لازم است.';
 const observedSpecifications=[...(result.summary.observedSpecifications||[])];
 if(parsed?.profile)observedSpecifications.push({name:'پروفیل',value:parsed.profile,evidence:parsed.evidence,source:'visible_marking'});
 if(parsed?.lengthMarking)observedSpecifications.push({name:'مارکینگ طول',value:parsed.lengthMarking,evidence:parsed.evidence,source:'visible_marking'});
 const brandMarking=parsed?.brandMarking;if(brandMarking)observedSpecifications.push({name:'نشان برند',value:brandMarking,evidence:parsed?.evidence||brandMarking,source:'visible_marking'});
 const pitchWasPrinted=candidateMarkings.some(m=>/(?:PITCH|GAM|گام)/i.test(normalizeMarking(m.text)));
 if(parsed?.nominalPitchMm&&pitchWasPrinted)observedSpecifications.push({name:'گام نوشته‌شده',value:String(parsed.nominalPitchMm)+' mm',evidence:parsed.evidence,source:'visible_marking'});
 const detectedPartType=hasVisualBeltEvidence?(parsed?.profile?beltTypeLabel(parsed.kind):'تسمه صنعتی'):'تطبیق تصویری تسمه تأیید نشد';
 const summaryText=!hasVisualBeltEvidence
  ?'تصویر با خانواده‌های فعال تسمه در کاتالوگ تطبیق تصویری کافی ندارد؛ نوع تسمه و سازگاری آن تأیید نشده است.'
  :candidateFamilies.length
   ?'در مسیر تخصصی تسمه، '+candidateFamilies.length+' خانواده قابل بررسی از کاتالوگ پیدا شد. شباهت تصویر و مارکینگ باید جداگانه از نظر فنی تأیید شوند.'
   :'تصویر به خانواده‌های تسمه نزدیک بود، اما پروفیل خوانده‌شده با اطلاعات هویتی خانواده‌های نزدیک هم‌خوانی ندارد.';
 const originalDescription=hasVisualBeltEvidence?(result.summary.whatYouSee||result.summary.visualAnalysis||''):'';
 const combinedDescription=[originalDescription,summaryText].filter((value,index,array)=>Boolean(value)&&array.indexOf(value)===index).join(' ');
 const catalogAvailability=candidateFamilies.length
  ?{status:'similar_in_catalog' as const,statusFarsiTitle:profileMatchStatus==='matched'?'پروفیل هم‌خوان در کاتالوگ':'خانواده مشابه تسمه در کاتالوگ',statusFarsiMessage:note}
  :{status:'custom_order_available' as const,statusFarsiTitle:hasVisualBeltEvidence?'پروفیل با خانواده‌های نزدیک هم‌خوان نیست':'تطبیق تصویری تسمه پیدا نشد',statusFarsiMessage:note+' این نتیجه به معنی تأیید موجودی یا امکان ساخت سفارشی نیست.'};
 const beltAnalysis:BeltRecognitionAnalysis={beltType:hasVisualBeltEvidence?(parsed?.kind||'unknown'):'unknown',beltTypeLabel:detectedPartType,visualBeltConfirmed:hasVisualBeltEvidence,profile:parsed?.profile||undefined,nominalPitchMm:parsed?.nominalPitchMm,lengthMarking:parsed?.lengthMarking,brandMarking,codeMatches:codeList,profileMatchStatus,candidateFamilies,evidence,note};
 return {...result,matchedProducts,modelSuggestions,similarCandidates,catalogImageMatches,nearestCatalogSuggestions,beltAnalysis,summary:{...result.summary,whatYouSee:combinedDescription,detectedPartType,partFamilyFarsi:hasVisualBeltEvidence?'تسمه صنعتی':'نیازمند بررسی',detectedProfile:parsed?.profile||'از روی مارکینگ قابل خواندن نبود',observedSpecifications:observedSpecifications.length?observedSpecifications.slice(0,8):undefined,catalogAvailability,exactVisualMatch:false,confidence:0,visualAnalysis:combinedDescription},technicalAdvice:!hasVisualBeltEvidence?(parsed?.profile?'مارکینگ '+parsed.profile+' خوانده شد، اما تصویر برای تأیید تسمه بودن قطعه کافی نیست؛ عکس واضح‌تر از کل قطعه و سطح نوشته‌دار لازم است.':'تصویر به خانواده‌های تسمه شباهت کافی نشان نداد؛ مطمئن شوید تصویر مربوط به تسمه است و از بدنه و سطح نوشته‌دار عکس واضح بگیرید.') : profileMatchStatus==='not-matched'?'پروفیل '+(parsed?.profile||'خوانده‌شده')+' با پروفیل‌های ثبت‌شده در خانواده‌های تصویری نزدیک هم‌خوان نیست؛ قبل از انتخاب، مارکینگ و اندازه‌ها را دوباره بررسی کنید.':parsed?.profile?'پروفیل '+parsed.profile+' از مارکینگ استخراج شد. '+(parsed.nominalPitchMm?'گام اسمی استاندارد این پروفیل '+parsed.nominalPitchMm+' میلی‌متر است؛ این مقدار جای اندازه‌گیری واقعی را نمی‌گیرد. ':'')+(parsed.lengthMarking?'عدد '+parsed.lengthMarking+' به‌عنوان مارکینگ طول ثبت شد؛ مبنای Li/La/Ld/Lp از این نوشته به‌تنهایی قطعی نیست. ':'')+'پیش از انتخاب، طول مرجع، عرض، تعداد دندانه، ساختار و شرایط کاری را با دیتاشیت یا اندازه‌گیری تأیید کنید.':'مارکینگ برای تشخیص قطعی پروفیل کافی نبود. از سطح نوشته‌دار عکس نزدیک‌تر بگیرید و در صورت امکان طول مرجع، عرض، تعداد دندانه و شرایط کاری را اعلام کنید.',catalogSearchWarning:[result.catalogSearchWarning,'در مسیر تخصصی تسمه، خانواده‌های غیرتسمه از پیشنهادها حذف شده‌اند. OCR ممکن است خطا داشته باشد و شباهت تصویری به‌تنهایی تأیید هویت یا سازگاری نیست.'].filter(Boolean).join(' ')};
}
