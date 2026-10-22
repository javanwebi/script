import type { Product } from '../types';

export function recognitionWorkerUrl(env: Record<string, string | undefined>): string {
  const value = (env.PART_RECOGNITION_WORKER_URL ?? 'https://atlas-aishenasaei.javanwebio.workers.dev').trim();
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname))
    throw new Error('PART_RECOGNITION_WORKER_URL must be an HTTPS origin.');
  return url.origin;
}
export function recognitionApiKey(env: Record<string, string | undefined>): string | undefined {
  for (const value of [env['ai-forza'], env.AI_FORZA_API_KEY, env.GEMINI_API_KEY]) {
    const key=(value || '').trim().replace(/^['"]|['"]$/g,'');
    if (key && !/^(MY_|YOUR_|PASTE_|SET_)/.test(key)) return key;
  }
}

/** Real inventory only. Family photos remain explicitly labelled examples. */
export function recognitionCatalog(products: Product[], allowedCodes?: ReadonlySet<string>) {
  return products.filter(p => p.active !== false).flatMap(p => (p.variants || []).filter(v => v.active !== false && (!allowedCodes || allowedCodes.has(v.code))).map(v => {
    const linked=p.galleryImages?.filter(img => img.scope === 'variant' && img.variantCode === v.code) || [];
    const dedicated = linked.find(img=>img.identityVerified)?.url || linked[0]?.url || v.images?.[0];
    return {code:v.code, forzaCode:'', name:v.name || p.name, brand:v.brand || p.brand,
      familyCode:p.code, categorySlug:p.categorySlug, categoryName:p.categoryName, subcategory:p.subcategory,
      page:0, imageIdentityVerified:linked.some(img=>img.url===dedicated && img.identityVerified===true), image:dedicated || p.images?.[0] || '', imageScope:dedicated ? 'variant' : 'family',
      specs:v.technicalSpecs || [], price:0, stock:0};
  }));
}
function normalizeCode(value: unknown) {
  return String(value ?? '').trim().replace(/[۰-۹]/g, d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLowerCase();
}
/** A visual confidence percentage is not proof of SKU identity. */
export function finalizeRecognition(result: any, catalog: ReturnType<typeof recognitionCatalog>, recognition: any = {}, aiAvailable=true, dimensionProofCodes:ReadonlySet<string>=new Set()) {
  const byCode=new Map(catalog.map(item=>[normalizeCode(item.code),item]));
  const imageOwners=new Map<string, Set<string>>();
  for (const item of catalog) if(item.image && item.imageScope === 'variant') {
    const codes=imageOwners.get(item.image) || new Set<string>();codes.add(item.code);imageOwners.set(item.image,codes);
  }
  const seen=new Set<string>();
  const pool=[...(result.matchedProducts || []), ...(result.similarCandidates || [])].flatMap(candidate=>{
    const item=byCode.get(normalizeCode(candidate.code));
    if(!item || seen.has(item.code) || candidate.visualVerdict === 'different') return [];
    seen.add(item.code);
    const readCode=normalizeCode(recognition.detected_code_on_part);
    const codeProof=readCode === normalizeCode(item.code) && Number.isFinite(Number(recognition.code_read_confidence)) && Number(recognition.code_read_confidence)>=90;
    const photoProof=item.imageIdentityVerified && item.imageScope === 'variant' && imageOwners.get(item.image)?.size===1 && Number(candidate.visualDistance)<=0.08;
    const dimensionProof=dimensionProofCodes.has(item.code);
    const exact=!candidate.dimensionMismatch && (codeProof || photoProof || dimensionProof);
    const scannedPhoto=(result.catalogImageMatches || []).find((photo:any)=>photo.imageId===candidate.matchedImageId && photo.bindings?.some((binding:any)=>binding.code===item.code));
    return [{...candidate, code:item.code,name:item.name,brand:item.brand,specs:item.specs,image:scannedPhoto?.image || item.image || undefined,
      imageScope:item.imageScope,identityEvidence:codeProof ? 'read-inventory-code' : photoProof ? 'dedicated-catalogue-photo' : dimensionProof ? 'unique-registered-dimensions' : 'similarity-only',
      visualVerdict:exact ? 'exact_match' : 'very_similar',
      matchReason:exact ? dimensionProof ? 'کد منطبق با تمام اندازه‌های اعلامی و مشخصات ثبت‌شده در خانوادهٔ تصویری؛ کنترل نهایی شرایط نصب لازم است.' : 'تطبیق با کد خوانده‌شده یا عکس اختصاصی همان کالا؛ کنترل نهایی ابعاد لازم است.' : 'شباهت ظاهری یا فنی؛ هویت دقیق کد از تصویر تأیید نشده است.',
      visualExplanation:exact ? 'شاهد تطبیق کد ثبت شده است.' : 'این پیشنهاد بر پایهٔ شباهت است؛ یکسان‌بودن قطعه ثابت نشده است.',
      technicalEvidence:(candidate.technicalEvidence || []).filter((text:unknown)=>typeof text==='string' && !/عین|قطعی|۱۰۰|100/.test(text)),
      visualVerdictFarsi:exact ? 'تطبیق کد کالا' : 'محصول مشابه؛ کد دقیق تأیید نشده',
      distinction:exact ? 'پیش از سفارش، ابعاد و شرایط کارکرد را کنترل کنید.' : 'این محصول شبیه قطعه شماست؛ یکسان‌بودن مدل، سایز یا جنس تأیید نشده است.'}];
  });
  const matchedProducts=pool.filter(c=>c.visualVerdict==='exact_match');
  const similarCandidates=pool.filter(c=>c.visualVerdict!=='exact_match');
  if (matchedProducts.length && !similarCandidates.length) {
    const families=new Set(matchedProducts.map(c=>byCode.get(normalizeCode(c.code))?.familyCode));
    for (const item of catalog) {
      if (seen.has(item.code) || !families.has(item.familyCode)) continue;
      similarCandidates.push({code:item.code,name:item.name,brand:item.brand,specs:item.specs,image:item.image || undefined,imageScope:item.imageScope,
        identityEvidence:'similarity-only',visualVerdict:'very_similar',visualVerdictFarsi:'گزینهٔ هم‌خانواده',distinction:'گزینهٔ هم‌خانواده؛ تطبیق تصویری و سازگاری فنی آن تأیید نشده است.'} as any);

    }
  }
  const exact=matchedProducts.length>0;
  const hasPhotoMatches=(result.catalogImageMatches || []).length>0;
  return {...result,recognitionPolicy:'inventory-v1',isAiGenerated:aiAvailable, matchedProducts,similarCandidates,rejectedCandidates:[],
    summary:{...result.summary,confidence:aiAvailable ? Math.min(exact ? 99 : 89,Number(result.summary?.confidence) || 0) : 0, confidenceNote:'امتیاز شباهت، احتمال قطعی هویت کالا نیست.',exactVisualMatch:exact,verifiedCandidateCount:matchedProducts.length+similarCandidates.length,
      catalogAvailability:{status:exact ? 'confirmed_in_catalog' : (similarCandidates.length || hasPhotoMatches) ? 'similar_in_catalog' : 'custom_order_available',
        statusFarsiTitle:exact ? 'کالای منطبق و محصولات مشابه' : (similarCandidates.length || hasPhotoMatches) ? 'تصاویر و محصولات مشابه پیدا شدند؛ کد دقیق را کنترل کنید' : 'تطبیق قابل اتکا پیدا نشد',
        statusFarsiMessage:exact ? 'کد منطبق پیدا شد؛ موجودی، ابعاد و شرایط کارکرد پیش از سفارش باید بررسی شوند.' : 'عدم تأیید تطبیق دقیق به معنی نبود کالا در انبار نیست. برای تشخیص دقیق‌تر، عکس نوشتهٔ قطعه و ابعاد را ارسال کنید.'}}};
}
