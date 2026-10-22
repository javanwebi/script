import { enrichProductTechnicalData } from './productTechnicalData';
import { applyCatalogueCorrections } from './catalogueCorrections';
import { groupProductFamilies } from './productFamilies';
import type { Product } from '../types';
import source from './catalogueSource.json';
import imageReview from './catalogueImages.json';
import { getProductImageUrl } from '../assets/imagesproducts';

// The workbook is authoritative. No synthetic prices, stock, ratings or technical claims.
const reviewedImages = imageReview as Record<string, { files: string[]; familyName: string }>;
export const USER_PRODUCTS_RAW: Product[] = source.map(family => {
  const review = reviewedImages[family.code];
  const images = review?.familyName === family.name ? review.files.map(getProductImageUrl) : [];
  const specs = [
    { key: 'نوع فنی', value: family.technicalType },
    { key: 'واحدهای فروش', value: family.unit },
    { key: 'تعداد کد کالا', value: String(family.itemCount) },
    ...(family.profiles ? [{ key: 'پروفیل‌ها', value: family.profiles }] : []),
    ...(family.materials ? [{ key: 'جنس‌های ثبت‌شده', value: family.materials }] : []),
  ];
  return applyCatalogueCorrections({
    code: family.code, name: family.name, brand: family.brand || 'ثبت نشده',
    categorySlug: categorySlugFor(family.categoryName), categoryName: family.categoryName,
    submenu: family.submenu, subcategory: family.technicalType,
    variants: family.variants, sourceRow: family.sourceRow,
    technicalSpecs: specs, prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0, stockKnown: false, inquiryOnly: true,
    images,
    hasCatalogueImage: images.length > 0,
    imageScope: images.length ? 'family-example' as const : undefined,
    unit: family.unit || 'عدد', tags: [family.submenu, family.technicalType, family.profiles || ''],
    description: `${family.name}؛ ${family.itemCount.toLocaleString('fa-IR')} کد کالا در این خانواده ثبت شده است. سایز و کد مورد نیاز را از فهرست زیر انتخاب کنید. قیمت و موجودی پس از استعلام اعلام می‌شود.`,
  });
});

// Stable, readable URLs are derived from the source category, never from row order.
export function categorySlugFor(name: string): string {
  return name.trim().replace(/[\s\u200c]+/g, '-');
}
export const USER_PRODUCTS = groupProductFamilies(USER_PRODUCTS_RAW).map(enrichProductTechnicalData);
const familyBySku = new Map(USER_PRODUCTS.flatMap(p => (p.variants || []).map(v => [v.code, p.code] as const)));
export const PRODUCT_FAMILY_ALIASES = new Map(USER_PRODUCTS_RAW.map(raw => [raw.code.toLowerCase(), familyBySku.get(raw.variants?.[0]?.code || '') || raw.code]));
export const USER_PRODUCTS_BY_CODE = new Map<string, Product>();
export const USER_PRODUCTS_BY_CATEGORY = new Map<string, Product[]>();
USER_PRODUCTS.forEach(product => {
  USER_PRODUCTS_BY_CODE.set(product.code.toLowerCase(), product);
  product.variants?.forEach(variant => USER_PRODUCTS_BY_CODE.set(variant.code.toLowerCase(), product));
  const categoryProducts = USER_PRODUCTS_BY_CATEGORY.get(product.categorySlug) || [];
  categoryProducts.push(product);
  USER_PRODUCTS_BY_CATEGORY.set(product.categorySlug, categoryProducts);
});
for (const [alias, canonical] of PRODUCT_FAMILY_ALIASES) {
  const product = USER_PRODUCTS_BY_CODE.get(canonical.toLowerCase());
  if (product) USER_PRODUCTS_BY_CODE.set(alias, product);
}
export const CATALOGUE_SKU_COUNT = source.reduce((total, family) => total + family.itemCount, 0);
export const normalizeCatalogueText = (value: string) => value.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
const searchIndex = new Map(USER_PRODUCTS.map(product => [product.code, normalizeCatalogueText([
  product.name, product.code, product.brand, product.categoryName, product.submenu, product.subcategory,
  ...product.technicalSpecs.map(s => s.value),
  ...(product.variants || []).flatMap(v => [v.code, v.size, v.name, v.model, ...(v.technicalSpecs || []).map(s => s.value), ...(v.technicalReview?.categoryPath || [])]),
].join(' '))]));
export function matchesProductSearch(product: Product, query: string) {
  const terms = normalizeCatalogueText(query).split(' ').filter(Boolean);
  const haystack = searchIndex.get(product.code) || normalizeCatalogueText(product.name);
  return terms.every(term => haystack.includes(term));
}
