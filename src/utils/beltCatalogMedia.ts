import beltManifestRaw from '../generated/beltCatalogManifest';
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

const manifest = beltManifestRaw as unknown as BeltCatalogManifest;
const EXCLUDED_FAMILY_SET = new Set<string>(manifest.excludedFamilyIds || []);
const EXCLUDED_MIXED_SKU_SET = new Set<string>(manifest.excludedMixedSkuIds || []);
const EXACT_REAL_SKU_SET = new Set<string>(manifest.exactRealSkuIds || []);

export interface BeltFamilyMedia {
  familyCode: string;
  menuCategorySlug: string;
  dominantDivision: string;
  existingDbImage: string | null;
  primaryThumbnail: string;
  familyPhotos: [string, string, string];
  specSheetWebp: string;
  specSheetSvg: string;
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

function normalizeOfficialDbImage(candidate?: string | null): string | null {
  const clean = String(candidate || '').trim();
  if (/^\/storage\/products\/(catalog\/e\([1-9]\d{0,3}\)\.png|thumbs\/e\([1-9]\d{0,3}\)\.webp)$/i.test(clean)) {
    return clean;
  }
  return null;
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
): BeltFamilyMedia | null {
  const clean = String(familyCode || '').trim();
  if (!isRealBeltFamily(clean)) return null;
  const entry = manifest.families[clean];
  const dbImg = normalizeOfficialDbImage(existingImageOverride) || normalizeOfficialDbImage(entry.db);
  const base = `/src/assets/catalog/belts/families/${encodeURIComponent(clean)}`;
  const photo1 = `${base}/family-image-01.webp`;
  const photo2 = `${base}/family-image-02.webp`;
  const photo3 = `${base}/family-image-03.webp`;

  return {
    familyCode: clean,
    menuCategorySlug: entry.s,
    dominantDivision: entry.d,
    existingDbImage: dbImg,
    primaryThumbnail: dbImg || photo1,
    familyPhotos: [photo1, photo2, photo3],
    specSheetWebp: `${base}/family-specifications.webp`,
    specSheetSvg: `${base}/family-specifications.svg`,
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

  return {
    skuCode: cleanSku,
    familyCode: mappedFamily,
    technicalDrawingWebp: `${base}/technical-drawing.webp`,
    technicalDrawingSvg: `${base}/technical-drawing.svg`,
    profileDrawingWebp: `${base}/profile-drawing.webp`,
    profileDrawingSvg: `${base}/profile-drawing.svg`,
    realProductImage: hasExactReal ? `${base}/real-product-image.webp` : null,
    realImageStatus: hasExactReal ? 'EXACT_SKU_IMAGE_FOUND' : 'REAL_IMAGE_NOT_FOUND',
    realImageStatusLabelFa: hasExactReal
      ? 'تصویر واقعی کالای فیزیکی تأییدشده'
      : 'تصویر واقعی هنوز تأمین نشده است',
  };
}

export function buildBeltGalleryImages(
  product: Pick<Product, 'code' | 'name' | 'image' | 'images' | 'variants'>,
  baseGallery: ProductGalleryImage[],
  activeSkuCode?: string | null,
): ProductGalleryImage[] {
  const familyMedia = getBeltFamilyMedia(
    product.code,
    product.images?.find((u) => Boolean(normalizeOfficialDbImage(u))) || product.image,
  );
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

  // 2. Append the 4 family visuals (3 verified real photos + 1 standard dimensions spec sheet)
  const photoLabels = [
    'نمای کلی تسمه',
    'نمای ساختار و دندانه',
    'مقطع لایه‌ها و ساختار داخلی',
  ];
  familyMedia.familyPhotos.forEach((url, idx) => {
    pushUnique({
      id: `belt-fam-${product.code}-${idx + 1}`,
      url,
      scope: 'family',
      title: `تصویر واقعی خانواده ${product.name} — ${photoLabels[idx]}`,
    });
  });
  pushUnique({
    id: `belt-fam-spec-${product.code}`,
    url: familyMedia.specSheetWebp,
    scope: 'family',
    title: `جدول مشخصات و استاندارد ابعاد خانواده ${product.name}`,
  });

  // 3. Preserve any existing non-belt variant DB images cleanly
  for (const img of baseGallery) {
    if (img.scope === 'variant') {
      pushUnique(img);
    }
  }

  // 4. Add verified physical exact-SKU real photos ONLY for SKUs that have one (41349, 52009, 52050)
  for (const variant of product.variants || []) {
    if (!variant?.code || isExcludedBeltSku(variant.code)) continue;
    const skuMedia = getBeltSkuMedia(product.code, variant.code);
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

  // 5. Append the orthogonal CAD profile drawing for the currently active SKU (or first valid belt SKU)
  const targetSku = String(
    activeSkuCode || product.variants?.find((v) => v?.code && !isExcludedBeltSku(v.code))?.code || '',
  ).trim();
  if (targetSku && !isExcludedBeltSku(targetSku)) {
    const activeSkuMedia = getBeltSkuMedia(product.code, targetSku);
    if (activeSkuMedia) {
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
