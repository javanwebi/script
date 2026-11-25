import beltManifestRaw from '../generated/beltCatalogManifest';
import popdBeltMediaRaw from '../generated/popdBeltMediaManifest';
import type { Product, ProductGalleryImage } from '../types';

export interface BeltManifestFamilyEntry {
  s: 'excel-v2-1-1' | 'excel-v2-1-2' | 'excel-v2-1-3' | 'excel-v2-1-4';
  d: string;
  db: string | null;
  p: [string, string, string];
}

export interface BeltCatalogManifest {
  version: number;
  generatedAt: string;
  totals: {
    realBeltFamilies: number;
    realBeltSkus: number;
    excludedPureNonBeltFamilies: number;
    excludedMixedNonBeltSkus: number;
    exactVerifiedRealSkuImages: number;
  };
  excludedFamilyIds: string[];
  excludedMixedSkuIds: string[];
  exactRealSkuIds: string[];
  families: Record<string, BeltManifestFamilyEntry>;
  skus: Record<string, string>;
}

type PopdBeltMediaManifest = {
  families: Record<string, Array<{ targetFile: string }>>;
  skuPhotos: Record<string, { targetFile: string }>;
};

const manifest = beltManifestRaw as unknown as BeltCatalogManifest;
const popdMedia = popdBeltMediaRaw as unknown as PopdBeltMediaManifest;
const EXCLUDED_FAMILY_SET = new Set<string>(manifest.excludedFamilyIds || []);
const EXCLUDED_MIXED_SKU_SET = new Set<string>(manifest.excludedMixedSkuIds || []);
const EXACT_REAL_SKU_SET = new Set<string>(Object.keys(popdMedia.skuPhotos || {}));

export interface BeltFamilyMedia {
  familyCode: string;
  menuCategorySlug: string;
  dominantDivision: string;
  existingDbImage: string | null;
  primaryThumbnail: string;
  familyPhotos: string[];
  specSheetWebp: string;
  specSheetSvg: string;
  hasVerifiedRealPhoto: boolean;
  hasVerifiedSpecSheet: boolean;
}

export interface BeltSkuMedia {
  skuCode: string;
  familyCode: string;
  technicalDrawingWebp: string;
  technicalDrawingSvg: string;
  profileDrawingWebp: string;
  profileDrawingSvg: string;
  realProductImage: string | null;
  realImageStatus: 'EXACT_SKU_IMAGE_FOUND' | 'REAL_IMAGE_NOT_FOUND';
  realImageStatusLabelFa: string;
}


export function getBeltManifestTotals() {
  return manifest.totals;
}

export function isExcludedBeltFamily(familyCode?: string | null): boolean {
  const clean = String(familyCode || '').trim();
  return Boolean(clean && EXCLUDED_FAMILY_SET.has(clean));
}

export function isRealBeltFamily(familyCode?: string | null): boolean {
  const clean = String(familyCode || '').trim();
  if (!clean || EXCLUDED_FAMILY_SET.has(clean)) return false;
  return Object.prototype.hasOwnProperty.call(manifest.families, clean);
}

export function isExcludedBeltSku(skuCode?: string | null): boolean {
  const clean = String(skuCode || '').trim();
  return Boolean(clean && EXCLUDED_MIXED_SKU_SET.has(clean));
}

export function isRealBeltSku(skuCode?: string | null): boolean {
  const clean = String(skuCode || '').trim();
  if (!clean || EXCLUDED_MIXED_SKU_SET.has(clean)) return false;
  return Object.prototype.hasOwnProperty.call(manifest.skus, clean);
}

export function getBeltFamilyMedia(
  familyCode?: string | null,
  existingImageOverride?: string | null,
  hints?: { legacyFamilyCodes?: string[]; variants?: unknown[] } | string[],
): BeltFamilyMedia | null {
  const legacyCodes = Array.isArray(hints) ? hints : (hints as { legacyFamilyCodes?: string[] } | undefined)?.legacyFamilyCodes || [];
  const candidates = [familyCode, ...legacyCodes].map((value) => String(value || '').trim()).filter(Boolean);
  const clean = candidates.find((candidate) => isRealBeltFamily(candidate)) || '';
  if (!clean) return null;
  const entry = manifest.families[clean];
  // POPD family photographs are mapped by exact family code and pinned source-file identity.
  // Do not fall back to old e(n).png thumbnails or generic master images for belt families.
  const base = `/src/assets/catalog/belts/families/${encodeURIComponent(clean)}`;
  const familyPhotos = (popdMedia.families[clean] || []).map(
    (photo) => `${base}/${encodeURIComponent(photo.targetFile)}`,
  );
  const hasVerifiedRealPhoto = familyPhotos.length > 0;

  return {
    familyCode: clean,
    menuCategorySlug: entry.s,
    dominantDivision: entry.d,
    existingDbImage: null,
    primaryThumbnail: familyPhotos[0] || '',
    familyPhotos,
    specSheetWebp: `${base}/family-specifications.webp`,
    specSheetSvg: `${base}/family-specifications.svg`,
    hasVerifiedRealPhoto,
    hasVerifiedSpecSheet: hasVerifiedRealPhoto,
  };
}

export function getBeltSkuMedia(
  familyCode?: string | null,
  skuCode?: string | null,
): BeltSkuMedia | null {
  const cleanSku = String(skuCode || '').trim();
  if (!cleanSku || isExcludedBeltSku(cleanSku)) return null;
  const mappedFamily = manifest.skus[cleanSku];
  if (!mappedFamily) return null;
  const cleanFamily = String(familyCode || '').trim();
  if (cleanFamily && cleanFamily !== mappedFamily) return null;

  const base = `/src/assets/catalog/belts/skus/${encodeURIComponent(cleanSku)}`;
  const hasExactReal = EXACT_REAL_SKU_SET.has(cleanSku);
  const exactPhoto = popdMedia.skuPhotos[cleanSku];

  return {
    skuCode: cleanSku,
    familyCode: mappedFamily,
    technicalDrawingWebp: `${base}/technical-drawing.webp`,
    technicalDrawingSvg: `${base}/technical-drawing.svg`,
    profileDrawingWebp: `${base}/profile-drawing.webp`,
    profileDrawingSvg: `${base}/profile-drawing.svg`,
    realProductImage: hasExactReal && exactPhoto ? `${base}/${encodeURIComponent(exactPhoto.targetFile)}` : null,
    realImageStatus: hasExactReal ? 'EXACT_SKU_IMAGE_FOUND' : 'REAL_IMAGE_NOT_FOUND',
    realImageStatusLabelFa: hasExactReal
      ? 'تصویر واقعی کالای فیزیکی تأییدشده'
      : 'تصویر واقعی هنوز تأمین نشده است',
  };
}

export function buildBeltGalleryImages(
  product: Pick<Product, 'code' | 'name' | 'image' | 'images' | 'variants'> & Partial<Pick<Product, 'legacyFamilyCodes'>>,
  baseGallery: ProductGalleryImage[],
  activeSkuCode?: string | null,
): ProductGalleryImage[] {
  const familyMedia = getBeltFamilyMedia(
    product.code,
    product.images?.find((u) => Boolean(normalizeOfficialDbImage(u))) || product.image,
  );

  const allowedFamilyCodes = new Set([product.code, ...(product.legacyFamilyCodes || [])].map((code) => String(code).trim().toUpperCase()).filter((code) => isRealBeltFamily(code)));
  const getProductSkuMedia = (skuCode?: string | null) => {
    const media = getBeltSkuMedia(undefined, skuCode);
    if (!media) return null;
    return allowedFamilyCodes.size && !allowedFamilyCodes.has(String(media.familyCode).toUpperCase()) ? null : media;
  };
  if (!familyMedia) return baseGallery;

  const result: ProductGalleryImage[] = [];
  const seenKeys = new Set<string>();
  const pushUnique = (img: ProductGalleryImage) => {
    const key = `${img.scope}:${img.variantCode || ''}:${img.url}`;
    if (!img.url || seenKeys.has(key)) return;
    seenKeys.add(key);
    result.push({ ...img, order: result.length + 1 });
  };

  // 1. Preserve official owner DB family images first (never overwrite e(*).png)
  for (const img of baseGallery) {
    if (img.scope === 'family') {
      pushUnique(img);
    }
  }
  if (familyMedia.existingDbImage) {
    pushUnique({
      id: `belt-db-${product.code}`,
      url: familyMedia.existingDbImage,
      scope: 'family',
      title: `تصویر اصلی کاتالوگ خانواده ${product.name}`,
    });
  }

  // 2. Add only POPD photographs explicitly mapped to this exact family code.
  const familyPhotoLabels = ['نمای اصلی', 'نمای زاویه‌ای', 'جزئیات ساختار', 'نمای نزدیک'];
  familyMedia.familyPhotos.forEach((url, index) => {
    pushUnique({
      id: `belt-family-photo-${product.code}-${index + 1}`,
      url,
      scope: 'family',
      title: `تصویر ${familyPhotoLabels[index] || 'مرجع'} خانواده ${product.name}`,
    });
  });

  // 3. Append the family specification sheet only when the family has verified POPD photos.
  if (familyMedia.hasVerifiedSpecSheet && familyMedia.specSheetWebp) {
    pushUnique({
      id: `belt-fam-spec-${product.code}`,
      url: familyMedia.specSheetWebp,
      scope: 'family',
      title: `جدول مشخصات و استاندارد ابعاد خانواده ${product.name}`,
    });
  }

  // 4. Preserve any existing non-belt variant DB images cleanly
  for (const img of baseGallery) {
    if (img.scope === 'variant') {
      pushUnique(img);
    }
  }

  // 5. Add only exact-SKU POPD physical photos; missing photos remain null.
  for (const variant of product.variants || []) {
    if (!variant?.code || isExcludedBeltSku(variant.code)) continue;
    const skuMedia = getProductSkuMedia(variant.code);
    if (skuMedia?.realProductImage) {
      pushUnique({
        id: `belt-sku-real-${variant.code}`,
        url: skuMedia.realProductImage,
        scope: 'variant',
        variantCode: variant.code,
        title: `تصویر واقعی کالای فیزیکی کد ${variant.code}`,
      });
    }
  }

  // 6. Append the orthogonal CAD profile drawing only when the active SKU has its own verified real photo.
  const targetSku = String(
    activeSkuCode || product.variants?.find((v) => v?.code && !isExcludedBeltSku(v.code))?.code || '',
  ).trim();
  if (targetSku && !isExcludedBeltSku(targetSku)) {
    const activeSkuMedia = getProductSkuMedia(targetSku);
    // A generated profile drawing is not a substitute for the exact physical SKU photo.
    // Publish the pair only when the same SKU has a verified real-product image.
    if (activeSkuMedia?.realProductImage && activeSkuMedia.profileDrawingWebp) {
      pushUnique({
        id: `belt-sku-profile-${targetSku}`,
        url: activeSkuMedia.profileDrawingWebp,
        scope: 'variant',
        variantCode: targetSku,
        title: `نقشه پروفیل و ابعاد مهندسی کد ${targetSku}`,
      });
    }
  }

  return result;
}
