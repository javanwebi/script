import type { Product } from "../types";

export type IndustryCatalogDefinition = {
  slug: string;
  title: string;
  terms: readonly string[];
};

const INDUSTRY_KEYWORDS: Record<string, readonly string[]> = {
  ceramic: ["کاشی", "سرامیک", "تسمه نقاله", "رولیک", "رولر", "چرخ", "یاتاقان", "بلبرینگ", "ضربه گیر", "کوپلینگ", "تفلون", "مکنده", "نسوز", "پولی"],
  textile: ["نساجی", "پارچه", "ریسندگی", "بافندگی", "رنگرزی", "غلتک", "رولیک", "گاید", "ریل", "تسمه", "پولی", "بلبرینگ", "یاتاقان"],
  packaging: ["بسته بندی", "کارتن", "کارتن سازی", "مکنده", "پروفیل", "چرخ", "رولر", "گاید", "تسمه", "زنجیر", "پولی"],
  food: ["غذایی", "نوشیدنی", "شیلنگ", "استیل", "آب بندی", "لاستیک", "ریل", "پلیمر", "تسمه نقاله"],
  machinery: ["ماشین سازی", "ماشین آلات", "یاتاقان", "بلبرینگ", "تفلون", "زنجیر", "کوپلینگ", "چرخ", "ریل", "پروفیل", "پولی"],
  rubber: ["لاستیک", "پلاستیک", "شیلنگ", "آب بندی", "نسوز", "تفلون", "گاید", "تسمه", "پولی"],
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("fa")
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200e\u200f\u0640]/g, "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

function productRelevance(product: Product, terms: readonly string[]): number {
  const name = normalize(product.name);
  const taxonomy = normalize([
    product.categoryName,
    product.category,
    product.categorySlug,
    product.subcategory,
  ].join(" "));
  const tags = normalize((product.tags || []).join(" "));
  const details = normalize([
    product.description,
    product.nameEn,
    product.brand,
    ...(product.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
    ...(product.variants || []).flatMap(variant => [variant.name, variant.size, variant.model]),
  ].join(" "));
  let score = 0;
  for (const rawTerm of terms) {
    const term = normalize(rawTerm);
    if (!term || term.length < 2) continue;
    if (name.includes(term)) score += 12;
    else if (taxonomy.includes(term)) score += 8;
    else if (tags.includes(term)) score += 6;
    else if (details.includes(term)) score += 2;
  }
  if (product.featured) score += 1;
  if (product.hasCatalogueImage) score += 1;
  return score;
}

/**
 * Rank only active, real catalogue families for an industry's technical context.
 * No placeholder family codes or invented products are returned.
 */
export function rankIndustryProducts(
  products: readonly Product[],
  industry: IndustryCatalogDefinition,
  limit = 6,
): Product[] {
  const terms = [...new Set([
    ...(industry.terms || []),
    ...(INDUSTRY_KEYWORDS[industry.slug] || []),
  ].map(normalize).filter(Boolean))];
  const seen = new Set<string>();
  return products
    .filter(product => product.active !== false && Boolean(product.code && product.name))
    .map(product => ({ product, score: productRelevance(product, terms) }))
    .filter(item => item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      Number(Boolean(b.product.featured)) - Number(Boolean(a.product.featured)) ||
      a.product.name.localeCompare(b.product.name, "fa"),
    )
    .filter(item => {
      const code = normalize(item.product.code);
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map(item => item.product);
}
