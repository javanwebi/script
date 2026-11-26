import type { Product } from '../../src/types';
import { findCatalogKnowledge } from '../../src/utils/catalogKnowledge';

export type ForzaRealtimeCatalogVariant = {
  code: string;
  name: string;
  size: string;
};

export type ForzaRealtimeCatalogFamily = {
  code: string;
  name: string;
  brand?: string;
  images: string[];
  link: string;
  description?: string;
  technicalSpecs?: Array<{ key: string; value: string }>;
  variants: ForzaRealtimeCatalogVariant[];
};

export type ForzaRealtimeCatalogResult = {
  success: boolean;
  query: string;
  familyCount: number;
  skuCount: number;
  results: ForzaRealtimeCatalogFamily[];
};

/**
 * Read-only voice-call search over the same in-memory catalogue snapshot that
 * is hydrated from the adopted PostgreSQL catalogue and live admin overrides.
 * Commercial fields are deliberately excluded from both tool and browser data.
 */
export function searchForzaRealtimeCatalog(
  products: Product[],
  query: string,
  requestedLimit = 6,
): ForzaRealtimeCatalogResult {
  const safeQuery = String(query || '').trim().slice(0, 120);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(6, Math.round(requestedLimit)))
    : 6;

  if (!safeQuery) {
    return { success: false, query: '', familyCount: 0, skuCount: 0, results: [] };
  }

  const activeProducts = products.filter(product => product.active !== false);
  const matches = findCatalogKnowledge(activeProducts, safeQuery, limit);
  const results: ForzaRealtimeCatalogFamily[] = matches.map(match => {
    const source = activeProducts.find(product => product.code === match.code);
    const matchedCodes = new Set(
      (match.variants || []).map((variant: any) => String(variant.code || '')),
    );
    const variants = (source?.variants || [])
      .filter(variant => variant.active !== false)
      .sort((a, b) => Number(matchedCodes.has(b.code)) - Number(matchedCodes.has(a.code)))
      .slice(0, 6)
      .map(variant => ({
        code: String(variant.code),
        name: String(variant.name || source?.name || match.name),
        size: String(variant.size || variant.model || ''),
      }));

    return {
      code: String(match.code),
      name: String(match.name),
      brand: match.brand ? String(match.brand) : undefined,
      images: Array.isArray(match.images) ? match.images.slice(0, 1) : [],
      link: String(match.link || '/product/' + encodeURIComponent(String(match.code))),
      description: match.description ? String(match.description).slice(0, 700) : undefined,
      technicalSpecs: Array.isArray(match.technicalSpecs)
        ? match.technicalSpecs.slice(0, 12).map((spec: any) => ({
            key: String(spec.key || '').slice(0, 80),
            value: String(spec.value || '').slice(0, 180),
          }))
        : [],
      variants,
    };
  });

  return {
    success: true,
    query: safeQuery,
    familyCount: results.length,
    skuCount: results.reduce((sum, family) => sum + family.variants.length, 0),
    results,
  };
}
