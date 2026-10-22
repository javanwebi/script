import type { Product } from '../types';

const normalize = (value = '') => value.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]+/g, ' ').trim();

/** Normalize catalog spelling; dimensions remain available on every original SKU. */
export function productFamilyName(product: Product): string {
  let name = normalize(product.name)
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/سیم\s*دار/g, 'سیم دار').replace(/ضد\s*سایش/g, 'ضدسایش')
    .replace(/فلز\s*دار/g, 'فلزدار').replace(/چهار\s*خار/g, 'چهار خار')
    .replace(/دوطرف/g, 'دو طرف').replace(/یکطرف/g, 'یک طرف')
    .replace(/دو\s*سر\s*پیچ/g, 'دو طرف پیچ')
    .replace(/دو\s*قلو|دوقلو/g, 'دوبل').replace(/سه\s*قلو/g, 'سه ردیفه')
    .replace(/تایمنیگ/g, 'تایمینگ').replace(/شافت/g, 'شفت')
    .replace(/\bopti\b/g, 'اپتی').replace(/مگداین|مگدان|\bmegadyne\b/g, 'مگادین')
    .replace(/(?:کد\s*\d+|\d+\s*کد)/g, '')
    .replace(/(?:قطر|ضخامت|طول|عرض)\s*\d+(?:[.,/]\d+)?/g, '')
    .replace(/\d+(?:[.,/]\d+)?\s*(?:میلیمتر|میلی متر|سانتیمتر|سانتی متر|اینچ)(?![آ-ی])/g, '')
    .replace(/[,،"؛]/g, ' ');
  if (/^بلبرینگ\s+(?:\d+\s*)?zz$/.test(name)) name = 'بلبرینگ zz';
  // Chain pitch and pulley diameter vary inside a family, row count stays distinct.
  if (/زنجیر/.test(name)) name = name.replace(/\b\d{2}b\b/g, '');
  if (/^پولی\s+(?:دوبل\s+)?2b\d+$/.test(name)) name = 'پولی دوبل 2b';
  // Rib count/length are sizes; PJ, PK and PL are different profiles.
  if (product.subcategory.includes('شیاری')) {
    name = name.replace(/^تسمه\s+(?:شیاری\s+)?/, 'تسمه شیاری ').replace(/aa\s*top/g, 'aa top')
      .replace(/\b\d+(pj|pk|pl|py)\d*\b/g, '$1')
      .replace(/\b(pj|pk|pl|py)\s+\1\b/g, '$1');
  }
  // Double-sided timing belts: preserve DH/DL series while removing length/width.
  if (product.categoryName === 'تسمه و انتقال نیرو') {
    name = name.replace(/\b\d+(dh|dl)\d*\b/g, '$1');
  }
  return name.replace(/\s+/g, ' ').trim();
}

// Only combine technically compatible records. Unknown/generic names stay separate.
export function groupProductFamilies(products: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const name = productFamilyName(product);
    const ambiguous = /^(مدل یا نام تجاری بدون نوع کالا|دستگاه صنعتی|قطعات کوره|تسمه خارجی|بلبرینگ)$/.test(name);
    const materials = product.technicalSpecs.find(s => s.key === 'جنس‌های ثبت‌شده')?.value || '';
    const key = JSON.stringify([product.categorySlug, normalize(product.submenu), normalize(product.subcategory), name.replace(/\s+/g, ''), normalize(product.brand), normalize(materials), product.unit, product.active !== false, ambiguous ? product.code : '']);
    const group = groups.get(key) || [];
    group.push(product);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    if (group.length === 1) return group[0];
    const canonical = group.find(p => normalize(p.name) === productFamilyName(p)) || group[0];
    const familyName = productFamilyName(canonical).replace(/[a-z]+/g, word => word.toUpperCase());
    const variants = [...new Map([canonical, ...group.filter(p => p !== canonical)].flatMap(p => p.variants || []).map(v => [v.code.toLowerCase(), v] as const).reverse()).values()].reverse();
    // Family illustrations are not exact SKU photographs: retain that distinction.
    const images = [...new Set(group.flatMap(p => p.images || []))];
    return { ...canonical, name: familyName, variants, images,
      galleryImages: group.flatMap(p => p.galleryImages || []),
      imageScope: images.length ? 'family-example' as const : undefined,
      technicalSpecs: canonical.technicalSpecs.map(s => s.key === 'تعداد کد کالا' ? { ...s, value: String(variants.length) } : s.key === 'پروفیل‌ها' ? { ...s, value: [...new Set(group.flatMap(p => p.technicalSpecs.filter(spec => spec.key === s.key).map(spec => spec.value)))].join(' / ') } : s),
      description: `${familyName}؛ ${variants.length.toLocaleString('fa-IR')} کد کالا. سایز و کد دقیق را از فهرست این خانواده انتخاب کنید.`,
    };
  });
}
