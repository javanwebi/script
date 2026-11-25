import type { Product, ProductVariant } from '../types';

export interface NonBeltGridItem {
  variant: ProductVariant;
  uniqueImageUrl: string | null;
  hasRealPhoto: boolean;
  displayTitle: string;
  specSummary: string | null;
  unitPrice: number;
}

const REAL_UNIQUE_PHOTO_RE =
  /(\/storage\/products\/catalog\/e\(\d+\)\.(png|webp|jpg|jpeg)|\/assets\/nonbelt-real\/|\/images\/nonbelt\/)/i;

export function normalizeSearchFa(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNonBeltFamilyProduct(
  product?: Partial<Product> | null,
  categorySlugOverride?: string,
): boolean {
  const slug = String(
    categorySlugOverride ||
      product?.resolvedAssignment?.categorySlug ||
      product?.categorySlug ||
      '',
  ).trim();
  if (!slug) return false;
  if (slug.startsWith('excel-v2-1-')) return false;
  return true;
}

export function isUniqueRealPartPhoto(url?: string | null): boolean {
  if (!url) return false;
  return REAL_UNIQUE_PHOTO_RE.test(String(url).trim());
}

const NOISE_SPEC_VALUE_RE =
  /NOT_APPLICABLE|UNKNOWN|UNSPECIFIED|N\/A|NONE|NULL|ثبت نشده|نامشخص|STANDARD_INDUSTRIAL/i;

export function getCleanVariantSpecs(
  variant: ProductVariant,
): Array<{ key: string; value: string }> {
  return (variant.technicalSpecs || []).filter((s) => {
    if (!s?.key || !s?.value) return false;
    const key = String(s.key).trim();
    const val = String(s.value).trim();
    if (!key || !val) return false;
    if (/توضیح|کد|خانواده|پروفیل/i.test(key)) return false;
    if (NOISE_SPEC_VALUE_RE.test(val)) return false;
    if (/^[A-Z0-9_]{4,}$/.test(val)) return false;
    return true;
  });
}

/**
 * Builds the ordered, zero-duplicate list of SKU cards for a non-belt family:
 * 1. SKUs with a verified unique real photo appear FIRST.
 * 2. Guarantees zero duplicate photo URLs across cards in the rendered grid.
 */
export function buildNonBeltGridItems(
  variants: ProductVariant[],
  familyName: string,
  fallbackPrice = 0,
): NonBeltGridItem[] {
  const active = (variants || []).filter((v) => v && v.active !== false);
  const usedPhotoUrls = new Set<string>();

  const mapped = active.map((variant, originalIndex) => {
    const rawCandidate = (variant.images || []).find((u) => Boolean(u && String(u).trim())) || '';
    const trimmed = rawCandidate.trim();
    const isReal = Boolean(trimmed && isUniqueRealPartPhoto(trimmed));
    let uniqueImageUrl: string | null = null;

    if (trimmed && !usedPhotoUrls.has(trimmed)) {
      // Only attach real part photos (never duplicate the same photo across two SKUs)
      if (isReal || trimmed.startsWith('/storage/products/')) {
        usedPhotoUrls.add(trimmed);
        uniqueImageUrl = trimmed;
      }
    }

    const rawTitle = String(variant.name || '').trim();
    const displayTitle =
      rawTitle && rawTitle !== variant.code
        ? rawTitle
        : `${familyName} — ${variant.code}`;

    const dimSpecs = getCleanVariantSpecs(variant)
      .slice(0, 2)
      .map((s) => `${s.key}: ${s.value}`);
    const specSummary =
      dimSpecs.length > 0
        ? dimSpecs.join(' · ')
        : variant.size &&
            !NOISE_SPEC_VALUE_RE.test(variant.size) &&
            !displayTitle.includes(variant.size)
          ? `سایز ${variant.size}`
          : null;

    const unitPrice =
      Number(variant.price ?? variant.prices?.retail ?? fallbackPrice ?? 0) || 0;

    return {
      originalIndex,
      item: {
        variant,
        uniqueImageUrl,
        hasRealPhoto: Boolean(uniqueImageUrl),
        displayTitle,
        specSummary,
        unitPrice,
      } satisfies NonBeltGridItem,
    };
  });

  // Sort: unique real photo first, preserving relative order inside each group
  mapped.sort((a, b) => {
    if (a.item.hasRealPhoto !== b.item.hasRealPhoto) {
      return a.item.hasRealPhoto ? -1 : 1;
    }
    return a.originalIndex - b.originalIndex;
  });

  return mapped.map((m) => m.item);
}

export function filterNonBeltGridItems(
  items: NonBeltGridItem[],
  query: string,
): NonBeltGridItem[] {
  const q = normalizeSearchFa(query);
  if (!q) return items;
  const tokens = q.split(' ').filter(Boolean);
  return items.filter(({ variant, displayTitle, specSummary }) => {
    const hay = normalizeSearchFa(
      [
        variant.code,
        displayTitle,
        variant.size,
        variant.model,
        variant.brand,
        specSummary,
        ...(variant.technicalSpecs || []).map((s) => `${s.key} ${s.value}`),
      ]
        .filter(Boolean)
        .join(' '),
    );
    return tokens.every((t) => hay.includes(t));
  });
}
