import { STORE_ASSETS } from '../assets/images';
import type { CategoryNode } from '../data/categories';
import type { Product } from '../types';

export type MenuFamilySummary = {
  code: string;
  name: string;
  brand: string;
  submenu: string | null;
  leaf: string | null;
  skuCount: number;
};

export type DynamicFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type CategoryFacetProfile = {
  primaryFacetTitle: string;
  primaryFacetOptions: DynamicFacetOption[];
  dimensionTitle: string;
  primaryDimLabel: string;
  secondaryDimLabel: string;
  searchPlaceholder: string;
};

export type ExtractedDimensions = {
  primaryValues: number[];
  secondaryValues: number[];
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeCatalogText(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('fa-IR')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[\u200c\s]+/g, ' ')
    .trim();
}

export function parseNumericInput(value: string): number | null {
  const cleaned = normalizeCatalogText(value)
    .replace(/[^\d.]/g, '')
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const EXCEL_GROUP_ARTWORK: Record<string, string> = {
  'excel-v2-1': STORE_ASSETS.categories.belts,
  'excel-v2-2': STORE_ASSETS.categories.conveyor,
  'excel-v2-3': STORE_ASSETS.subcategories.rollerConveyorHero,
  'excel-v2-4': STORE_ASSETS.categories.pulleys,
  'excel-v2-5': STORE_ASSETS.subcategories.industrialBrushes,
  'excel-v2-6': STORE_ASSETS.subcategories.guideRailsProfiles,
  'excel-v2-7': STORE_ASSETS.subcategories.polymerSealsHero,
  'excel-v2-8': STORE_ASSETS.subcategories.refractoryPtfeCord,
  'excel-v2-9': STORE_ASSETS.categories.chains,
  'excel-v2-10': STORE_ASSETS.subcategories.ceramicGlazeRotary,
  'excel-v2-11': STORE_ASSETS.subcategories.wireMeshScreens,
  'excel-v2-12': STORE_ASSETS.reverseEngineeringLab,
  'excel-v2-13': STORE_ASSETS.categories.bearings,
  'excel-v2-14': STORE_ASSETS.subcategories.spongesFoamScourers,
};

export const EXCEL_CATEGORY_ARTWORK_BY_SLUG: Record<string, string> = {
  'excel-v2-1-1': STORE_ASSETS.subcategories.timingBeltHero,
  'excel-v2-1-2': STORE_ASSETS.subcategories.vbeltRibbedHero,
  'excel-v2-1-3': STORE_ASSETS.subcategories.puWeldedBeltHero,
  'excel-v2-1-4': STORE_ASSETS.subcategories.flatBeltsWelder,
  'excel-v2-2-1': STORE_ASSETS.categories.conveyor,
  'excel-v2-2-2': STORE_ASSETS.companyPages.servicesHero,
  'excel-v2-3-1': STORE_ASSETS.products.ceramicRoller,
  'excel-v2-3-2': STORE_ASSETS.subcategories.rollerConveyorHero,
  'excel-v2-3-3': STORE_ASSETS.forzaSubFittings,
  'excel-v2-4-1': STORE_ASSETS.products.aluPulley,
  'excel-v2-4-2': STORE_ASSETS.categories.pulleys,
  'excel-v2-5-1': STORE_ASSETS.subcategories.industrialBrushes,
  'excel-v2-5-2': STORE_ASSETS.subcategories.industrialBrushes,
  'excel-v2-6-1': STORE_ASSETS.subcategories.guideRailsProfiles,
  'excel-v2-6-2': STORE_ASSETS.subcategories.guideRailsProfiles,
  'excel-v2-6-3': STORE_ASSETS.subcategories.guideRailsProfiles,
  'excel-v2-6-4': STORE_ASSETS.predictiveMaintenanceSensor,
  'excel-v2-7-1': STORE_ASSETS.forzaSubFittings,
  'excel-v2-7-2': STORE_ASSETS.subcategories.polymerSealsHero,
  'excel-v2-7-3': STORE_ASSETS.forzaSubFittings,
  'excel-v2-8-1': STORE_ASSETS.subcategories.refractoryPtfeCord,
  'excel-v2-8-2': STORE_ASSETS.subcategories.refractoryPtfeCord,
  'excel-v2-9-1': STORE_ASSETS.categories.chains,
  'excel-v2-9-2': STORE_ASSETS.products.pump,
  'excel-v2-9-3': STORE_ASSETS.forzaSubCoupling,
  'excel-v2-9-4': STORE_ASSETS.forzaSubCoupling,
  'excel-v2-10-1': STORE_ASSETS.subcategories.ceramicGlazeRotary,
  'excel-v2-10-2': STORE_ASSETS.subcategories.ceramicGlazeRotary,
  'excel-v2-11-1': STORE_ASSETS.subcategories.wireMeshScreens,
  'excel-v2-12-1': STORE_ASSETS.reverseEngineeringLab,
  'excel-v2-13-1': STORE_ASSETS.products.bearingNsk,
  'excel-v2-13-2': STORE_ASSETS.forzaSubBearing,
  'excel-v2-14-1': STORE_ASSETS.subcategories.spongesFoamScourers,
  'excel-v2-14-2': STORE_ASSETS.subcategories.spongesFoamScourers,
  'excel-v2-14-3': STORE_ASSETS.subcategories.spongesFoamScourers,
};

export function resolveExcelCategoryArtwork(
  categorySlug?: string | null,
  categoryName?: string | null,
  explicitImage?: string | null,
): string {
  const cleanedImage = String(explicitImage || '').trim();
  if (cleanedImage && cleanedImage.startsWith('/images/') && !/belt-hero-cinematic|scan-industrial-generated|reverse-engineering-generated/.test(cleanedImage)) {
    return cleanedImage;
  }

  const slug = String(categorySlug || '').trim().toLowerCase();
  if (slug && EXCEL_CATEGORY_ARTWORK_BY_SLUG[slug]) {
    return EXCEL_CATEGORY_ARTWORK_BY_SLUG[slug];
  }

  const groupMatch = slug.match(/^(excel-v2-\d+)/);
  if (groupMatch && EXCEL_GROUP_ARTWORK[groupMatch[1]]) {
    return EXCEL_GROUP_ARTWORK[groupMatch[1]];
  }

  const norm = normalizeCatalogText(`${categoryName || ''} ${slug}`);
  if (/برس/.test(norm)) return STORE_ASSETS.subcategories.industrialBrushes;
  if (/سنسور/.test(norm)) return STORE_ASSETS.predictiveMaintenanceSensor;
  if (/ریل|گاید|پروفیل|پایه کشویی|نرده/.test(norm)) return STORE_ASSETS.subcategories.guideRailsProfiles;
  if (/نسوز|برزنتی|تفلون|نخ نسوز/.test(norm)) return STORE_ASSETS.subcategories.refractoryPtfeCord;
  if (/توری|مش/.test(norm)) return STORE_ASSETS.subcategories.wireMeshScreens;
  if (/اسپاتول|روتاری|چاپ|لعاب/.test(norm)) return STORE_ASSETS.subcategories.ceramicGlazeRotary;
  if (/اسفنج|ابر|اسکاج/.test(norm)) return STORE_ASSETS.subcategories.spongesFoamScourers;
  if (/تایمینگ|timing/.test(norm)) return STORE_ASSETS.subcategories.timingBeltHero;
  if (/وی.?بلت|v-belt|شیاری/.test(norm)) return STORE_ASSETS.subcategories.vbeltRibbedHero;
  if (/جوشی|گرد|پلی.?یورتان|crc/.test(norm)) return STORE_ASSETS.subcategories.puWeldedBeltHero;
  if (/بارکش|فلت|دستگاه/.test(norm)) return STORE_ASSETS.subcategories.flatBeltsWelder;
  if (/نوار نقاله|کانوایر/.test(norm)) return STORE_ASSETS.categories.conveyor;
  if (/رولر|غلتک|بوش|فنر|پین/.test(norm)) return STORE_ASSETS.subcategories.rollerConveyorHero;
  if (/پولی/.test(norm)) return STORE_ASSETS.products.aluPulley;
  if (/اورینگ|کاسه نمد|پکینگ|لاستیکی|ضربه.?گیر|مکنده/.test(norm)) return STORE_ASSETS.subcategories.polymerSealsHero;
  if (/زنجیر/.test(norm)) return STORE_ASSETS.categories.chains;
  if (/پمپ/.test(norm)) return STORE_ASSETS.products.pump;
  if (/یراق|لولا|چرخ/.test(norm)) return STORE_ASSETS.forzaSubCoupling;
  if (/سفارشی|نقشه/.test(norm)) return STORE_ASSETS.reverseEngineeringLab;
  if (/بلبرینگ|یاتاقان/.test(norm)) return STORE_ASSETS.products.bearingNsk;
  if (/تسمه/.test(norm)) return STORE_ASSETS.categories.belts;

  return STORE_ASSETS.categories.transmission;
}

export function resolveSubcategoryThumb(
  nodeName: string,
  categoryName: string,
  categorySlug: string,
): string {
  const combined = normalizeCatalogText(`${nodeName} ${categoryName} ${categorySlug}`);
  const nodeNorm = normalizeCatalogText(nodeName);

  if (/کلاسیک|\b(z|a|b|c|d|e)\b/.test(nodeNorm) && /وی.?بلت|v-belt|1-2/.test(combined) && !/اسپشیال|متری/.test(nodeNorm)) {
    return STORE_ASSETS.categories.belts;
  }
  if (/اسپشیال|spa|spb|spc|دندانه/.test(nodeNorm) && /وی.?بلت|v-belt|1-2/.test(combined)) {
    return STORE_ASSETS.subcategories.vbeltRibbedHero;
  }
  if (/متری/.test(nodeNorm) && /وی.?بلت|تسمه|1-2/.test(combined)) {
    return STORE_ASSETS.forzaSubBelt;
  }

  if (/سیم.?دار|پلی.?یورتان|apl|کامیون/.test(nodeNorm) && /تایمینگ|timing|1-1/.test(combined)) {
    return STORE_ASSETS.subcategories.puWeldedBeltHero;
  }
  if (/لاستیکی/.test(nodeNorm) && /تایمینگ|timing|1-1/.test(combined)) {
    return STORE_ASSETS.subcategories.timingBeltHero;
  }
  if (/گام|کدهای تایمینگ/.test(nodeNorm)) {
    return STORE_ASSETS.products.forzaBelt;
  }
  if (/گرد|crc/.test(combined)) {
    return STORE_ASSETS.subcategories.puWeldedBeltHero;
  }
  if (/دستگاه.*جوش|فلت|تخت/.test(nodeNorm) || /1-4/.test(categorySlug)) {
    return /تسمه بارکش/.test(nodeNorm) ? STORE_ASSETS.products.pvcBelt : STORE_ASSETS.subcategories.flatBeltsWelder;
  }
  if (/برس|1-5|2-5|5-1|5-2/.test(combined) && /برس/.test(combined)) {
    return STORE_ASSETS.subcategories.industrialBrushes;
  }
  if (/سنسور/.test(nodeNorm) || categorySlug === 'excel-v2-6-4') {
    return STORE_ASSETS.predictiveMaintenanceSensor;
  }
  if (/ریل|گاید|پروفیل|پایه کشویی|نرده/.test(combined)) {
    return STORE_ASSETS.subcategories.guideRailsProfiles;
  }
  if (/نسوز|برزنتی|نخ نسوز/.test(combined)) {
    return STORE_ASSETS.subcategories.refractoryPtfeCord;
  }
  if (/چاپ|اسپاتول|روتاری/.test(combined)) {
    return STORE_ASSETS.subcategories.ceramicGlazeRotary;
  }
  if (/توری|مش/.test(combined)) {
    return STORE_ASSETS.subcategories.wireMeshScreens;
  }
  if (/اسفنج|ابر|اسکاج/.test(combined)) {
    return STORE_ASSETS.subcategories.spongesFoamScourers;
  }
  if (/بازدید و نصب|خدمات نوار نقاله/.test(combined)) {
    return STORE_ASSETS.companyPages.servicesHero;
  }
  if (/کاربرد و ابعاد|بسته.?بندی/.test(nodeNorm) && /نوار نقاله|2-1/.test(combined)) {
    return STORE_ASSETS.products.pvcBelt;
  }
  if (/نوار نقاله|بر اساس جنس|pvc/.test(combined)) {
    return STORE_ASSETS.categories.conveyor;
  }
  if (/خار نگهدارنده/.test(nodeNorm) || categorySlug === 'excel-v2-3-3') {
    return STORE_ASSETS.forzaSubFittings;
  }
  if (/بوش|فنر|پین|رولر|غلتک/.test(combined)) {
    return /غلتک|روکش/.test(combined)
      ? STORE_ASSETS.products.ceramicRoller
      : STORE_ASSETS.subcategories.rollerConveyorHero;
  }
  if (/پولی/.test(combined)) {
    return /پلاستیک/.test(nodeNorm) ? STORE_ASSETS.categories.pulleys : STORE_ASSETS.products.aluPulley;
  }
  if (/اورینگ|کاسه نمد|پکینگ/.test(combined)) {
    return STORE_ASSETS.subcategories.polymerSealsHero;
  }
  if (/لاستیکی|ضربه.?گیر|مکنده/.test(combined)) {
    return STORE_ASSETS.forzaSubFittings;
  }
  if (/زنجیر/.test(combined)) {
    return STORE_ASSETS.categories.chains;
  }
  if (/پمپ/.test(combined)) {
    return STORE_ASSETS.products.pump;
  }
  if (/یراق|دستگیره|لولا|چرخ/.test(combined)) {
    return STORE_ASSETS.forzaSubCoupling;
  }
  if (/سفارشی|نقشه/.test(combined)) {
    return STORE_ASSETS.reverseEngineeringLab;
  }
  if (/مهره و واشر/.test(nodeNorm)) {
    return STORE_ASSETS.forzaSubBearing;
  }
  if (/یاتاقان/.test(combined)) {
    return STORE_ASSETS.categories.bearings;
  }
  if (/بلبرینگ/.test(combined)) {
    return STORE_ASSETS.products.bearingNsk;
  }

  return resolveExcelCategoryArtwork(categorySlug, categoryName);
}

export function extractNumericDimensions(
  family: MenuFamilySummary,
  product?: Product,
): ExtractedDimensions {
  const primarySet = new Set<number>();
  const secondarySet = new Set<number>();

  const specs = [
    ...(product?.technicalSpecs || []),
    ...(product?.variants || []).flatMap(v => v.technicalSpecs || []),
  ];

  for (const spec of specs) {
    const key = normalizeCatalogText(spec.key);
    const val = normalizeCatalogText(spec.value);
    const nums = val.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(n => Number.isFinite(n) && n > 0) || [];
    if (!nums.length) continue;

    if (/طول|قطر\s*بیرونی|قطر\s*درونی|قطر\s*سوراخ|مدل پایه|طول نامی|عدد طول/.test(key)) {
      nums.forEach(n => primarySet.add(n));
    } else if (/عرض|ضخامت|ارتفاع|گام|تعداد دندانه/.test(key)) {
      nums.forEach(n => secondarySet.add(n));
    } else if (/توالی ابعاد/.test(key) && nums.length >= 2) {
      primarySet.add(nums[0]);
      secondarySet.add(nums[1]);
    }
  }

  // Fallback: extract explicit dimension numbers from belt/part names & variant sizes (e.g., SPA 1250, 8M-1600-30, 6205)
  const sources = [
    family.name,
    product?.name || '',
    ...(product?.variants || []).slice(0, 8).flatMap(v => [v.size || '', v.name || '']),
  ];
  for (const raw of sources) {
    const text = normalizeCatalogText(raw);
    const beltLenMatch = text.match(/\b(?:sp[zabc]|xp[zabc]|ax|bx|cx|a|b|c|d|e|z|3v|5v|8v|pk|pj|pl)\s*[-/]?\s*(\d{2,5}(?:\.\d+)?)\b/i);
    if (beltLenMatch) {
      const n = Number(beltLenMatch[1]);
      if (Number.isFinite(n) && n > 0) primarySet.add(n);
    }
    const timingMatch = text.match(/\b(\d{3,4})\s*[-]?\s*(?:8m|5m|14m|3m|t10|t5|at10|at5|h|l|xl|xh)\b/i);
    if (timingMatch) {
      const n = Number(timingMatch[1]);
      if (Number.isFinite(n) && n > 0) primarySet.add(n);
    }
    const dimPair = text.match(/(\d+(?:\.\d+)?)\s*[*×x]\s*(\d+(?:\.\d+)?)/i);
    if (dimPair) {
      const a = Number(dimPair[1]);
      const b = Number(dimPair[2]);
      if (Number.isFinite(a) && a > 0) primarySet.add(a);
      if (Number.isFinite(b) && b > 0) secondarySet.add(b);
    }
  }

  return {
    primaryValues: Array.from(primarySet),
    secondaryValues: Array.from(secondarySet),
  };
}

export function matchesDimensionRange(
  dims: ExtractedDimensions,
  lenMinStr: string,
  lenMaxStr: string,
  dimMinStr: string,
  dimMaxStr: string,
): boolean {
  const lenMin = parseNumericInput(lenMinStr);
  const lenMax = parseNumericInput(lenMaxStr);
  const dimMin = parseNumericInput(dimMinStr);
  const dimMax = parseNumericInput(dimMaxStr);

  if (lenMin !== null || lenMax !== null) {
    if (!dims.primaryValues.length) return false;
    const ok = dims.primaryValues.some(val =>
      (lenMin === null || val >= lenMin) &&
      (lenMax === null || val <= lenMax),
    );
    if (!ok) return false;
  }

  if (dimMin !== null || dimMax !== null) {
    if (!dims.secondaryValues.length) return false;
    const ok = dims.secondaryValues.some(val =>
      (dimMin === null || val >= dimMin) &&
      (dimMax === null || val <= dimMax),
    );
    if (!ok) return false;
  }

  return true;
}

const TIMING_PITCH_TOKENS = ['8M', '5M', '14M', '3M', 'T10', 'AT10', 'T5', 'AT5', 'T20', 'AT20', 'XL', 'L', 'H', 'XH', 'XXH', 'HTD'];
const VBELT_PROFILE_TOKENS = ['A', 'B', 'C', 'D', 'E', 'Z', 'SPA', 'SPB', 'SPC', 'SPZ', 'AX', 'BX', 'CX', 'XPA', 'XPB', 'XPC', 'XPZ'];

export function matchesDynamicFacetToken(
  family: MenuFamilySummary,
  product: Product | undefined,
  token: string,
): boolean {
  if (!token) return true;
  const target = normalizeCatalogText(token).replace(/\s+/g, '');
  const specs = [
    ...(product?.technicalSpecs || []),
    ...(product?.variants || []).flatMap(v => v.technicalSpecs || []),
  ];

  for (const spec of specs) {
    const val = normalizeCatalogText(spec.value).replace(/\s+/g, '');
    if (val === target) return true;
    const splitTokens = String(spec.value || '')
      .split(/[،,\s]+/)
      .map(s => normalizeCatalogText(s).replace(/\s+/g, ''))
      .filter(Boolean);
    if (splitTokens.includes(target)) return true;
  }

  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryRegex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}(\\s*[-/]?\\s*\\d|\\d+|\\s|$)`, 'i');
  if (boundaryRegex.test(family.name) || boundaryRegex.test(product?.name || '')) {
    return true;
  }

  return (product?.variants || []).some(
    v => boundaryRegex.test(v.size || '') || boundaryRegex.test(v.name || ''),
  );
}

export function buildCategoryFacetProfile(
  slug: string,
  categoryName: string,
  families: MenuFamilySummary[],
  products: Map<string, Product>,
): CategoryFacetProfile {
  const lowerSlug = slug.toLowerCase();
  const normName = normalizeCatalogText(categoryName);

  const isTiming = lowerSlug === 'excel-v2-1-1' || /تایمینگ|timing/.test(normName);
  const isVBelt = lowerSlug === 'excel-v2-1-2' || /وی.?بلت|v-belt/.test(normName);
  const isBearing = lowerSlug.startsWith('excel-v2-13-') || /بلبرینگ|یاتاقان/.test(normName);
  const isChain = lowerSlug.startsWith('excel-v2-9-') || /زنجیر/.test(normName);
  const isPulley = lowerSlug.startsWith('excel-v2-4-') || /پولی/.test(normName);
  const isRollerOrGuide = lowerSlug.startsWith('excel-v2-3-') || lowerSlug.startsWith('excel-v2-6-') || /رولر|ریل|گاید/.test(normName);

  if (isTiming) {
    const options = TIMING_PITCH_TOKENS.map(token => ({
      value: token,
      label: `گام ${token}`,
      count: families.filter(f => matchesDynamicFacetToken(f, products.get(f.code), token)).length,
    }))
      .filter(opt => opt.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      primaryFacetTitle: 'گام و پروفیل تایمینگ',
      primaryFacetOptions: options,
      dimensionTitle: 'ابعاد و اندازه',
      primaryDimLabel: 'طول تسمه (میلی‌متر)',
      secondaryDimLabel: 'عرض یا گام (میلی‌متر)',
      searchPlaceholder: 'جستجوی کد تایمینگ (8M / T10 / AT10)، برند یا خانواده…',
    };
  }

  if (isVBelt) {
    const options = VBELT_PROFILE_TOKENS.map(token => ({
      value: token,
      label: token.length === 1 ? `${token} (کلاسیک)` : token,
      count: families.filter(f => matchesDynamicFacetToken(f, products.get(f.code), token)).length,
    }))
      .filter(opt => opt.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      primaryFacetTitle: 'پروفیل (نوع مقطع)',
      primaryFacetOptions: options,
      dimensionTitle: 'ابعاد و طول',
      primaryDimLabel: 'طول تسمه (میلی‌متر)',
      secondaryDimLabel: 'عرض مقطع (میلی‌متر)',
      searchPlaceholder: 'جستجوی کد تسمه (SPA 1250 / BX 48)، برند یا سایز…',
    };
  }

  // Generic data-driven facet extraction from real technicalSpecs across all sibling categories
  const specCounts = new Map<string, { label: string; count: number }>();
  const targetKeys = /پروفیل|سری زنجیر|مدل پایه|پسوند درج‌شده|جنس توصیف‌شده|نوع قطعه|ساختار درج‌شده|رنگ درج‌شده/i;

  for (const fam of families) {
    const prod = products.get(fam.code);
    const seenForFamily = new Set<string>();
    const specs = [
      ...(prod?.technicalSpecs || []),
      ...(prod?.variants?.slice(0, 5) || []).flatMap(v => v.technicalSpecs || []),
    ];

    for (const s of specs) {
      if (!s.key || !s.value || !targetKeys.test(s.key)) continue;
      const parts = String(s.value)
        .split(/[،,]/)
        .map(x => x.trim())
        .filter(x => x.length >= 2 && x.length <= 28);
      for (const val of parts) {
        const keyNorm = normalizeCatalogText(val);
        if (!keyNorm || seenForFamily.has(keyNorm) || keyNorm === 'ثبت نشده' || keyNorm === 'نامشخص') continue;
        seenForFamily.add(keyNorm);
        const prev = specCounts.get(keyNorm);
        specCounts.set(keyNorm, { label: prev?.label || val, count: (prev?.count || 0) + 1 });
      }
    }
  }

  const options = Array.from(specCounts.values())
    .map(entry => ({ value: entry.label, label: entry.label, count: entry.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 14);

  return {
    primaryFacetTitle: isBearing
      ? 'سری و آب‌بندی بلبرینگ'
      : isChain
        ? 'سری و استاندارد زنجیر'
        : isPulley
          ? 'گام و متریال پولی'
          : isRollerOrGuide
            ? 'متریال و تیپ قطعه'
            : 'مشخصات و متریال فنی',
    primaryFacetOptions: options,
    dimensionTitle: 'ابعاد و اندازه',
    primaryDimLabel: isBearing ? 'قطر سوراخ / کد پایه (mm)' : 'طول / قطر اصلی (میلی‌متر)',
    secondaryDimLabel: isBearing ? 'عرض / قطر بیرونی (mm)' : 'عرض / ضخامت (میلی‌متر)',
    searchPlaceholder: `جستجوی نام، کد فنی یا مشخصات ${categoryName}…`,
  };
}

export function buildPaginationWindow(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage - 1 >= 1) pages.add(currentPage - 1);
  if (currentPage + 1 <= totalPages) pages.add(currentPage + 1);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = Array.from(pages).filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const tokens: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      tokens.push('ellipsis');
    }
    tokens.push(sorted[i]);
  }
  return tokens;
}

export function buildSubcategoryStripNodes(
  nodes: CategoryNode[],
  categoryName: string,
): Array<{ key: string; name: string; isAllOption: boolean; children: CategoryNode[] }> {
  const visible = (nodes || []).filter(node => node.hidden !== true);
  const mapped = visible.map(node => ({
    key: node.name,
    name: node.name,
    isAllOption: false,
    children: (node.children || []).filter(child => child.hidden !== true),
  }));

  // When a category has 1..3 subnodes, append a balanced "همه مدل‌های {category}" card so the strip
  // sits cleanly on desktop without leaving awkward empty grid tracks, matching the 4-card reference layout.
  if (mapped.length > 0 && mapped.length <= 3) {
    mapped.push({
      key: '__all__',
      name: `همه ${categoryName}`,
      isAllOption: true,
      children: [],
    });
  }
  return mapped;
}
