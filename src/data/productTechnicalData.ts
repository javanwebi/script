import { partResearchRequirements, type ComparisonReference } from './partResearchRequirements';
import { classifyPartName } from './partClassification';
import { checkImperialDesignation, type DesignationCheck } from './imperialTimingReference';
import { ownerPinDimensions, type OwnerCatalogueEvidence } from './ownerCatalogue';
import type { Product, ProductVariant, TechnicalSpec } from '../types';

export const TECHNICAL_REFERENCES = {
  imperial: { title: 'Optibelt — Imperial timing belt designation', url: 'https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-gummi/Optibelt-TM-Rubber-Timing-Belt-Drives.pdf' },
  mitsuboshiTiming: { title: 'Mitsuboshi — Standard timing belt size tables', url: 'https://global.mitsuboshi.com/assetFiles/timing_belt_design_manual_en.pdf' },
  misumiTiming: { title:'MISUMI — H timing belts, reference lengths',url:'https://th.c.misumi-ec.com/book/THA_EconomySeries_e-catalog2023_2nd/files/basic-html/page605.html' },
  imperialStandard: { title: 'ISO 19347:2015 — Imperial trapezoidal belts and pulleys', url: 'https://www.iso.org/standard/64662.html' },
  bearing62200: { title:'ISK — 62200 nominal boundary dimensions',url:'https://iskbearing.com/product-details/62200' },
  wedge: { title: 'Optibelt — Wedge belt profiles', url: 'https://www.optibelt.com/fileadmin/pdf/kataloge/Optibelt-Power-Transmission-product-range-belts.pdf' },
  ribbed: { title: 'Optibelt — Ribbed belt drives', url: 'https://www.optibelt.com/fileadmin/extranet/power_transmission/technische_Unterlagen/OPTIBELT-TM-Ribbed-Belt-Drives.pdf' },
  timing: { title: 'Optibelt — ALPHA LINEAR', url: 'https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-pu/optibelt-ALPHA-LINEAR-Product-range.pdf' },
  chain: { title: 'Renold — Transmission chains', url: 'https://tr.renold.com/media/165422/transmission-ren1-de-07-10.pdf' },
  bearing: { title: 'SKF — Bearing designation system', url: 'https://www.skf.com/binaries/pub12/Images/0901d196802809de-Rolling-bearings---17000_1-EN_tcm_12-121486.pdf' },
} as const;
type Reference = keyof typeof TECHNICAL_REFERENCES;
export interface TechnicalReview {
  status: 'reference-enriched' | 'catalog-extracted' | 'needs-identification';
  categoryPath: string[];
  technicalCode?: string;
  catalogPartCode?: string;
  standardStatus?: 'reference-only' | 'not-established';
  originalTechnicalType?: string;
  designationCheck?: DesignationCheck;
  researchWarnings?: string[];
  ownerCatalogue?: OwnerCatalogueEvidence;
  requiredChecks?: string[];
  comparisonReferences?: ComparisonReference[];
  evidence: { key: string; basis: 'catalog' | 'owner-catalogue' | 'profile-reference' | 'admin'; source?: Reference; value?: string }[];
  references: { title: string; url: string }[];
  missing: string[];
  note: string;
}
const normalize = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\u200c/g, ' ').toUpperCase();
const wedge: Record<string, [number, number]> = { SPZ: [9.7,8], SPA:[12.7,10], SPB:[16.3,13], SPC:[22,18] };
const ribPitch: Record<string, number> = { PH:1.6, PJ:2.34, PK:3.56, PL:4.7, PM:9.4 };
const timingPitch: Record<string, number> = { T5:5,T10:10,T20:20,AT5:5,AT10:10,AT20:20 };
const imperialPitch: Record<string,number> = { MXL:2.032,XL:5.08,L:9.525,H:12.7,XH:22.225,XXH:31.75,DXL:5.08,DL:9.525,DH:12.7 };
const num = (value:number) => String(Math.round(value*1000)/1000);
const chainPitch: Record<string, number> = { '04B':6,'05B':8,'06B':9.525,'08B':12.7,'10B':15.875,'12B':19.05,'16B':25.4,'20B':31.75,'24B':38.1 };

/** Read the actual SKU inscription, never the warehouse SKU as a manufacturer code.
 * Reference dimensions describe a profile, not a certified manufacturer datasheet.
 */
export function enrichTechnicalVariant(product: Product, variant: ProductVariant): ProductVariant {
  const name = normalize(variant.name);
  const rawSize = normalize(variant.size || '');
  const specs: TechnicalSpec[] = [];
  const evidence: TechnicalReview['evidence'] = [];
  const refs = new Set<Reference>();
  let model: string | undefined;
  let technicalCode: string | undefined;
  let designationCheck: DesignationCheck | undefined;
  const researchWarnings: string[]=[];
  const classification=classifyPartName(name);
  let type = classification?.type || product.subcategory;
  const isBelt=classification ? classification.belt : product.categoryName === 'تسمه و انتقال نیرو';
  const catalogPartCode = name.match(/کد\s*[:：-]?\s*((?:[آ-ی]\s*\/\s*)?[A-Z0-9]+(?:\s*[./-]\s*[A-Z0-9]+)*)/)?.[1]?.replace(/\s+/g,'');
  const add = (key: string, value: string, source?: Reference) => {
    specs.push({key,value});
    evidence.push({key,value,basis:source ? 'profile-reference' : 'catalog',...(source ? {source} : {})});
    if (source) refs.add(source);
  };
  if (isBelt) {
    const narrow = (name.match(/\b(SP[ZABC]|XP[ZABC])\s*[-/]?\s*(\d+(?:\.\d+)?)\b/) || rawSize.match(/\b(SP[ZABC]|XP[ZABC])\s*(\d+(?:\.\d+)?)\b/));
    const rib = name.match(/\b(?:(\d+)\s*)?(PH|PJ|PK|PL|PM)\s*[-/]?\s*(\d{3,5})\b/);
    const timing = name.match(/(?:^|[^A-Z])(AT20|AT10|AT5|T20|T10|T5|14M|8M|5M|3M)(?=$|[^A-Z0-9]|\d{3,5}\b)/);
    const imperial = name.match(/\b(\d{2,5}(?:\.\d+)?)\s*(DXL|XXH|MXL|XH|XL|DH|DL|H|L)(?![A-Z])/);
    const classic = name.match(/\b(AX|BX|CX|Z|A|B|C|D|E)\s*[-/]?\s*(\d+(?:\.\d+)?)\b/);
    if (narrow) {
      model = narrow[1]; technicalCode = `${model} ${narrow[2]}`;
      type = model.startsWith('XP') ? 'تسمه V شکل باریک دندانه‌دار' : 'تسمه V شکل باریک';
      add('پروفیل', model);
      add('طول درج‌شده در کد', `${narrow[2]} میلی‌متر`);
      if (wedge[model]) {
        add('عرض اسمی بالای پروفیل (مرجع)', `${wedge[model][0]} میلی‌متر`, 'wedge');
        add('ارتفاع اسمی پروفیل (مرجع)', `${wedge[model][1]} میلی‌متر`, 'wedge');
        add('مبنای طول پروفیل (مرجع)', 'طول مبنا Ld؛ تطبیق با دیتاشیت سازنده', 'wedge');
        add('استاندارد مرجع پروفیل', 'DIN 7753-1 / ISO 4184؛ گواهی این کالا تأیید نشده', 'wedge');
      }
    } else if (rib) {
      model = rib[2]; technicalCode = `${rib[1] || ''}${model} ${rib[3]}`;
      type = 'تسمه چندشیاری'; add('پروفیل',model);
      if(rib[1]) add('تعداد شیار درج‌شده',rib[1]);
      add('طول درج‌شده در کد',`${rib[3]} میلی‌متر`);
      add('گام شیار پروفیل (مرجع)',`${ribPitch[model]} میلی‌متر`,'ribbed');
    } else if (timing) {
      model = timing[1]; type = 'تسمه تایمینگ'; add('پروفیل',model);
      // Do not infer rounded tooth geometry from pitch alone (e.g. HTD vs GT).
      if (timingPitch[model]) add('گام دندانه پروفیل (مرجع)',`${timingPitch[model]} میلی‌متر`,'timing');
      else if (/^(3M|5M|8M|14M)$/.test(model)) add('گام دندانه پروفیل (مرجع)',`${Number(model.slice(0,-1))} میلی‌متر`,'imperial');
    } else if (imperial) {
      const suffix=name.slice((imperial.index||0)+imperial[0].length);
      const widthCode=suffix.match(/^\s*[-*]?\s*(\d{3})(?![A-Z0-9])/)?.[1];
      model=imperial[2];technicalCode=`${imperial[1]}${model}${widthCode||''}`;
      type=model.startsWith('D') ? 'تسمه تایمینگ اینچی دوطرف دندانه' : 'تسمه تایمینگ اینچی';
      add('پروفیل',model);
      add('گام اسمی دندانه (مرجع)',`${imperialPitch[model]} میلی‌متر`,'imperial');
      designationCheck=checkImperialDesignation(imperial[1],model);
      if(model==='MXL' && !/اپتی|OPTIBELT/.test(name)) {
        designationCheck={status:'reference-conflict',designation:`${imperial[1]}MXL`,sourceUrl:TECHNICAL_REFERENCES.imperial.url,identityVerified:false};
        researchWarnings.push('روش عددگذاری MXL در کاتالوگ Optibelt و Mitsuboshi یکسان نیست؛ بدون تعیین سازنده، طول از عدد مدل استخراج نمی‌شود.');
      }
      const lengthReference: Reference=designationCheck.sourceUrl.includes('misumi-ec.com') ? 'misumiTiming' : designationCheck.sourceUrl===TECHNICAL_REFERENCES.mitsuboshiTiming.url ? 'mitsuboshiTiming' : 'imperial';
      if(designationCheck.status==='listed-reference-length') {
        add('طول گام در جدول مرجع',`${num(designationCheck.lengthMm!)} میلی‌متر`,lengthReference);
        add('تعداد دندانه در جدول مرجع',String(designationCheck.teeth),lengthReference);
        if(designationCheck.pdfPage)add('صفحهٔ PDF مرجع طول',String(designationCheck.pdfPage),lengthReference);
        if(designationCheck.sourcePage)add('صفحهٔ چاپی مرجع طول',String(designationCheck.sourcePage),lengthReference);
      } else add('ابهام نام‌گذاری طول',designationCheck.status==='reference-conflict' ? 'طول و تعداد دندانه در جدول مرجع ناسازگار است؛ طول منتشر نشده و دیتاشیت همان سازنده لازم است' : 'این کد طول در جدول بررسی‌شده وجود ندارد؛ طول و تعداد دندانه بدون دیتاشیت همان مدل منتشر نمی‌شود');
      if(widthCode && /^(012|019|025|031|037|043|050|063|075|100|150|200|250|300|400|500)$/.test(widthCode))
        add('عرض از کد سه‌رقمی اینچی (مرجع)',`${num(Number(widthCode)*0.254)} میلی‌متر`,'imperial');
      add('استاندارد مرجع نام‌گذاری','ISO 19347:2015؛ گواهی کالای موجود تأیید نشده','imperialStandard');
    } else if (classic) {
      model = classic[1]; technicalCode = `${model} ${classic[2]}`;
      type = /X/.test(model) ? 'تسمه V شکل کلاسیک دندانه‌دار' : 'تسمه V شکل کلاسیک';
      add('پروفیل',model); add('عدد طول درج‌شده (بدون تبدیل واحد)',classic[2]);
    } else {
      const weldedProfile = /جوشی/.test(name) ? name.match(/\b(A|B|C|D|Z|CRC)(?:\b|(?=\d))/) : undefined;
      const usWedge = name.match(/\b(3VX|5VX|8VX|3V|5V|8V)\s*(\d+)\b/);
      if(weldedProfile){model=weldedProfile[1];type='تسمه جوشی پروفیل‌دار';add('پروفیل درج‌شده',model);}
      else if(usWedge){model=usWedge[1];technicalCode=`${model} ${usWedge[2]}`;type='تسمه V شکل باریک اینچی';add('پروفیل درج‌شده',model);add('عدد طول درج‌شده (بدون تبدیل واحد)',usWedge[2]);}
    }
  } else if (/^بلبرینگ/.test(name)) {
    const bearing = name.match(/\b(6\d{2,4})(?:\s*[-/]?\s*(ZZ|2RSZ|2RS|2Z|RS|Z))?(?!\d)/);
    if(bearing) { model = bearing[1]; technicalCode = bearing[0].replace(/\s+/g,''); add('مدل پایه',model);
      if(bearing[2]) add('پسوند درج‌شده',bearing[2]);
      if(model==='62200'){add('قطر سوراخ اسمی مدل پایه (مرجع)','10 میلی‌متر','bearing62200');add('قطر بیرونی اسمی مدل پایه (مرجع)','30 میلی‌متر','bearing62200');add('عرض اسمی مدل پایه (مرجع)','14 میلی‌متر','bearing62200');}
      // Only the explicit standard bore-code range; special bores are not inferred.
      if(model.length === 4 && !name.includes('/')) {
        const code = Number(model.slice(-2));
        if(code <= 3 || (code >= 4 && code <= 96)) add('قطر سوراخ اسمی از کد پایه (مرجع)',`${code <= 3 ? [10,12,15,17][code] : code * 5} میلی‌متر`,'bearing');
      }
    }
  } else if (/زنجیر/.test(name)) {
    const chain = name.match(/\b(04B|05B|06B|08B|10B|12B|16B|20B|24B)(?:[- ]([123]))?\b/);
    if(chain) { model=chain[1]; technicalCode=chain[0]; add('سری زنجیر',model);
      add('گام اسمی زنجیر (مرجع)',`${chainPitch[model]} میلی‌متر`,'chain');
      const rows = chain[2] || (/سه\s*(?:ردیفه|قلو)/.test(name) ? '3' : /دوبل|دو\s*قلو/.test(name) ? '2' : undefined);
      if(rows) add('تعداد ردیف درج‌شده',rows);
    }
  }
  // Physical descriptions are copied as written; colloquial names are not
  // converted into unverified polymer grades (e.g. تفلون is not proof of PTFE).
  // Material of a mating part, coating or belt is not the material of the item.
  const bodyDescription=name.split(/مخصوص|جهت|برای|نگهدارنده|همراه|با\s*روکش|روکش|داخل/)[0];
  const material = bodyDescription.match(/سیلیکون(?:ی)?|پلی\s*یورتان|پلی\s*اورتان|پلی\s*[آا]مید(?:ی)?|تفلون(?:ی)?|لاستیک(?:ی)?|آلومینیوم(?:ی)?|فولاد(?:ی)?|استیل|چدن(?:ی)?|برنج(?:ی)?|پلاستیک(?:ی)?|PTFE|NBR|EPDM/);
  if(material) add('جنس توصیف‌شده در کاتالوگ',material[0]);
  const color = name.match(/قرمز|سبز|مشکی|سفید|زرد|آبی|طوسی|شفاف|نارنجی|قهوه\s*ای/);
  if(color) add('رنگ درج‌شده',color[0]);
  const construction = name.match(/مدار\s*بسته|متری|آستین|جوشی|روکش\s*دار|سیم\s*دار/);
  if(construction) add('ساختار درج‌شده',construction[0]);
  // Other catalog items: preserve explicitly labelled models and dimensions only.
  for (const [label,key] of [['قطر','قطر درج‌شده'],['عرض','عرض درج‌شده'],['ارتفاع','ارتفاع درج‌شده'],['ضخامت','ضخامت درج‌شده'],['طول','طول درج‌شده']] as const) {
    const match = name.match(new RegExp(`${label}\\s*(\\d+(?:[./]\\d+)?)\\s*(میلیمتر|میلی متر|سانتیمتر|سانتی متر|اینچ)?`));
    if(match) add(key,`${match[1]}${match[2] ? ' '+match[2] : ' (واحد در منبع مشخص نیست)'}`);
  }
  const rotex = name.match(/\bROTEX\s*(\d+)\b/);
  if(rotex){
    model=`ROTEX ${rotex[1]}`;add('شناسه ROTEX درج‌شده در شرح',model);
    if(![14,19,24,28,38,42,48,55,65,75,90,100,110,125,140,160,180].includes(Number(rotex[1])))
      researchWarnings.push(`اندازهٔ ${rotex[1]} در جدول فعلی ROTEX Standard شرکت KTR دیده نشد؛ شمارهٔ اصلی حفظ شده و نباید با اندازهٔ نزدیک جایگزین شود.`);
  }
  const explicitModel = name.match(/(?:مدل|MODEL)\s*[:：-]?\s*([A-Z0-9][A-Z0-9./-]*)/);
  if(!model && explicitModel) model=explicitModel[1];
  if(catalogPartCode) add('کد موجود در نام اصلی کالا',catalogPartCode);
  const dimensionSequence=name.match(/\d+(?:[./]\d+)?(?:\s*[*×]\s*\d+(?:[./]\d+)?){1,3}/)?.[0];
  if(dimensionSequence) add('توالی ابعاد درج‌شده (محورها و واحد تأیید نشده)',dimensionSequence);
  if(technicalCode) add('کد فنی خوانده‌شده از شرح کالا',technicalCode);
  const owner=ownerPinDimensions(variant.code,variant.name);
  if(owner){
    type='پین سر رولر';
    if(owner.evidence.conflict)researchWarnings.push(owner.evidence.conflict);
    for(const spec of owner.specifications){specs.push(spec);evidence.push({...spec,basis:'owner-catalogue'});}
  }
  add('نوع قطعه',type);
  const missing = ['دیتاشیت همان سازنده / تطبیق با پلاک کالا'];
  if(!model && !variant.model) missing.push('مدل فنی قابل‌تأیید');
  missing.push('کد کامل و پسوندهای سفارش سازنده');
  if(!product.brand || product.brand === 'ثبت نشده') missing.push('سازنده');
  const requirements=partResearchRequirements(type,name);
  const review: TechnicalReview = {
    requiredChecks:requirements.checks, comparisonReferences:requirements.comparisonReferences, researchWarnings,ownerCatalogue:owner?.evidence,
    status:refs.size ? 'reference-enriched' : model || technicalCode || catalogPartCode ? 'catalog-extracted' : 'needs-identification',
    categoryPath:[product.categoryName, product.submenu || product.subcategory, type, ...(model ? [model] : [])],
    technicalCode, catalogPartCode, designationCheck, standardStatus:refs.size ? 'reference-only' : 'not-established', originalTechnicalType:product.subcategory, evidence:evidence.map(e => variant.technicalSpecs?.some(s => s.key === e.key && s.value !== specs.find(x=>x.key === e.key)?.value) ? {key:e.key,basis:'admin' as const} : e), references:[...refs].map(key=>TECHNICAL_REFERENCES[key]), missing,
    note:'اطلاعات خوانده‌شده از شرح کاتالوگ و ابعاد اسمی مرجع؛ انطباق کالای واقعی و مشخصات اختصاصی سازنده نیازمند دیتاشیت است.',
  };
  // Manually entered specifications take precedence over automatic extraction.
  const manual = (variant.technicalSpecs || []).filter(spec => !variant.technicalReview?.evidence.some(e=>e.key===spec.key && e.value===spec.value && e.basis!=='admin'));
  return {...variant, model:variant.model || model, technicalReview:review,
    technicalSpecs:[...specs.filter(s => !manual.some(m => m.key === s.key)),...manual]};
}
export function enrichProductTechnicalData(product: Product): Product {
  return {...product,variants:product.variants?.map(v=>enrichTechnicalVariant(product,v))};
}
