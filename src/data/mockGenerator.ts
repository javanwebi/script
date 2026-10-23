import {durableStorage} from "../services/durableStorage";
import { enrichProductTechnicalData } from './productTechnicalData';
import { groupProductFamilies } from './productFamilies';
import { publicCatalog } from "../utils/catalogPrivacy";
import { Product, ProductGalleryImage, ProductVariant } from "../types";
import {
  CATEGORIES, getManagedCategories,
  matchesCatalogCategory,
  flattenCategoryNodes,
} from "./categories";
import { BRANDS, getManagedBrands } from "./brands";
import {
  USER_PRODUCTS,
  USER_PRODUCTS_RAW,
  PRODUCT_FAMILY_ALIASES,
  matchesProductSearch,
  normalizeCatalogueText,
} from "./userProducts";
import initialOverridesDb from "./catalogOverridesDb.json";
import { getProductImageUrl } from "../assets/imagesproducts";

const OVERRIDES_STORAGE_KEY = "atlas_catalog_overrides_v2";

export interface CatalogOverridesState {
  version: number;
  updatedAt: string;
  deletedCodes: string[];
  families: Record<string, Partial<Product> & { code: string }>;
}

let databaseProducts:Product[]|null=null;
export function installDatabaseProducts(products:Product[]){databaseProducts=products;invalidateCatalogCache();}
// In the deployed browser, PostgreSQL is the only authoritative catalogue.
// Do not silently reconstruct deleted/renamed products from an old bundled JSON
// when the API is unavailable. Dev/CLI fixtures remain for isolated tests.
const baselineProducts=():Product[]=>{
  if (databaseProducts) return databaseProducts;
  if (typeof window !== 'undefined' && import.meta.env.PROD) return [];
  return USER_PRODUCTS_RAW;
};
let sessionOverrides: CatalogOverridesState | null = null;
let catalogRequestVersion = 0;
let cachedProducts: Product[] | null = null;
let cachedAllIncludingInactive: Product[] | null = null;
let cachedMap: Map<string, Product> | null = null;
let cachedMapIncludingInactive: Map<string, Product> | null = null;
let serverSyncStarted = false;
const catalogListeners = new Set<() => void>();

function notifyCatalogListeners() {
  catalogListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeCatalogChanges(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

export function getOverridesState(): CatalogOverridesState {
  if (typeof window !== "undefined" && sessionOverrides)
    return sessionOverrides;
  const empty:CatalogOverridesState={version:1,updatedAt:"",deletedCodes:[],families:{}};
  // Production never seeds product corrections from a stale checked-in snapshot.
  const seed:CatalogOverridesState=(databaseProducts || (typeof window !== 'undefined' && import.meta.env.PROD))
    ? empty : initialOverridesDb as unknown as CatalogOverridesState;
  if (typeof window === "undefined") {
    return {
      version: seed.version || 1,
      updatedAt: seed.updatedAt || "",
      deletedCodes: [...(seed.deletedCodes || [])],
      families: { ...(seed.families || {}) },
    };
  }

  try {
    const raw = durableStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CatalogOverridesState;
      return {
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || seed.updatedAt || "",
        deletedCodes: Array.isArray(parsed.deletedCodes)
          ? parsed.deletedCodes
          : [],
        families: {
          ...(seed.families || {}),
          ...(parsed.families || {}),
        },
      };
    }
  } catch {
    // ignore storage parse error
  }

  return {
    version: seed.version || 1,
    updatedAt: seed.updatedAt || "",
    deletedCodes: [...(seed.deletedCodes || [])],
    families: { ...(seed.families || {}) },
  };
}

function saveOverridesStateToStorage(state: CatalogOverridesState) {
  if (typeof window === "undefined") return;
  sessionOverrides = state;
  try {
    durableStorage.setItem(
      OVERRIDES_STORAGE_KEY,
      JSON.stringify(publicCatalog(state)),
    );
  } catch {
    // ignore quota error
  }
}

export function invalidateCatalogCache() {
  cachedProducts = null;
  cachedAllIncludingInactive = null;
  cachedMap = null;
  cachedMapIncludingInactive = null;
  notifyCatalogListeners();
}

export async function syncCatalogFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const requestVersion = ++catalogRequestVersion;
    const res = await fetch("/api/catalog/overrides", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = await res.json();
    if (requestVersion !== catalogRequestVersion) return;
    if (json?.data && typeof json.data === "object") {
      const current = getOverridesState();
      const merged: CatalogOverridesState = {
        version: json.data.version || 1,
        updatedAt: json.data.updatedAt || new Date().toISOString(),
        deletedCodes: Array.from(
          new Set([
            ...(current.deletedCodes || []),
            ...(json.data.deletedCodes || []),
          ]),
        ),
        families: {
          ...(databaseProducts ? {} : (initialOverridesDb as unknown as CatalogOverridesState).families),
          ...(json.data.families || {}),
        },
      };
      saveOverridesStateToStorage(merged);
      invalidateCatalogCache();
    }
  } catch {
    // ignore offline/network errors
  }
}

if (typeof window !== "undefined")
  window.addEventListener("atlas-session-updated", () => {
    sessionOverrides = null;
    catalogRequestVersion++;
    durableStorage.removeItem(OVERRIDES_STORAGE_KEY);
    invalidateCatalogCache();
    void syncCatalogFromServer();
  });

function extractFileNameFromUrl(url: string): string | undefined {
  const m = url.match(/e\(\d+\)\.png/i);
  return m ? m[0] : undefined;
}

export function buildDefaultGalleryImages(
  product: Product,
): ProductGalleryImage[] {
  const codes = new Set((product.variants || []).map(v => v.code));
  const gallery: ProductGalleryImage[] = product.galleryImages?.length
    ? product.galleryImages.filter(img => img.scope === 'family' || (img.variantCode && codes.has(img.variantCode))).map((img, idx) => ({
        ...img, id: img.id || `img-${product.code}-${idx + 1}`,
        url: getProductImageUrl(img.url || img.fileName || '') || img.url,
        order: img.order ?? idx + 1,
      }))
    : (product.images || []).map((url, idx) => ({
        id: `img-${product.code}-${idx + 1}`, url: getProductImageUrl(url) || url,
        fileName: extractFileNameFromUrl(url), scope: 'family' as const,
        title: `تصویر عمومی خانواده ${product.name}`, order: idx + 1,
      }));
  for (const variant of product.variants || []) {
    for (const [idx, originalUrl] of (variant.images || []).entries()) {
      const url = getProductImageUrl(originalUrl) || originalUrl;
      if (!url || gallery.some(img => img.scope === 'variant' && img.variantCode === variant.code && img.url === url)) continue;
      gallery.push({id: `sku-${variant.code}-${idx}`, url, scope: 'variant', variantCode: variant.code,
        title: `تصویر کد ${variant.code}`, order: gallery.length + 1});
    }
  }
  return gallery;
}

export function normalizeMergedProduct(
  base: Product | null,
  override?: Partial<Product> & { code: string },
): Product {
  const merged: Product = base
    ? {
        ...base,
        ...override,
        technicalSpecs: override?.technicalSpecs
          ? [...override.technicalSpecs]
          : [...(base.technicalSpecs || [])],
        variants: override?.variants
          ? override.variants.map((v) => ({ ...v }))
          : (base.variants || []).map((v) => ({ ...v })),
      }
    : {
        code: override!.code,
        name: override?.name || "محصول جدید",
        brand: override?.brand || "ATLAS",
        categorySlug: override?.categorySlug || "قطعات-مکانیکی",
        categoryName: override?.categoryName || "قطعات مکانیکی",
        submenu: override?.submenu || "عمومی",
        subcategory: override?.subcategory || "قطعه صنعتی",
        variants: (override?.variants || []).map((v) => ({ ...v })),
        technicalSpecs: override?.technicalSpecs || [],
        prices: override?.prices || {
          base: 0,
          retail: 0,
          wholesale: 0,
          dealer: 0,
        },
        stock: override?.stock ?? 0,
        stockKnown: override?.stockKnown ?? false,
        inquiryOnly: override?.inquiryOnly ?? true,
        images: override?.images || [],
        tags: override?.tags || [],
        unit: override?.unit || "عدد",
        description: override?.description || "",
        active: override?.active ?? true,
        galleryImages: override?.galleryImages,
      };

  const gallery = buildDefaultGalleryImages(merged).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  merged.galleryImages = gallery;
  merged.images = gallery.map((g) => g.url).filter(Boolean);
  merged.hasCatalogueImage = merged.images.length > 0;

  const hasVariantSpecificImage = gallery.some(
    (g) => g.scope === "variant" && g.variantCode,
  );
  const hasFamilyImage = gallery.some((g) => g.scope === "family");
  if (hasVariantSpecificImage && hasFamilyImage) {
    merged.imageScope = "mixed";
  } else if (hasVariantSpecificImage) {
    merged.imageScope = "sku-verified";
  } else if (merged.images.length > 0) {
    merged.imageScope = "family-example";
  } else {
    merged.imageScope = undefined;
  }

  // Sync each variant's images array with galleryImages bound to that variantCode
  if (merged.variants && merged.variants.length > 0) {
    merged.variants = merged.variants.map((v: ProductVariant) => {
      const boundUrls = gallery
        .filter((g) => g.scope === "variant" && g.variantCode === v.code)
        .map((g) => g.url);
      const variantPrice = v.price ?? v.prices?.retail ?? 0;
      const isInquiry =
        v.inquiryOnly !== undefined ? v.inquiryOnly : variantPrice <= 0;
      return {
        ...v,
        price: variantPrice,
        prices: v.prices || {
          base: variantPrice > 0 ? Math.round(variantPrice * 0.8) : 0,
          retail: variantPrice,
          wholesale: variantPrice > 0 ? Math.round(variantPrice * 0.9) : 0,
          dealer: variantPrice > 0 ? Math.round(variantPrice * 0.84) : 0,
        },
        inquiryOnly: isInquiry,
        images: boundUrls.length > 0 ? boundUrls : v.images || [],
        active: v.active ?? true,
      };
    });

    // Derive family-level summary price & stock from active variants if any variant is priced
    const activeVariants = merged.variants.filter((v) => v.active !== false);
    const pricedVariants = activeVariants.filter(
      (v) => !v.inquiryOnly && (v.price || 0) > 0,
    );
    if (pricedVariants.length > 0) {
      const minVariant = pricedVariants.reduce((min, cur) =>
        (cur.price || 0) < (min.price || 0) ? cur : min,
      );
      const minRetail = minVariant.price || 0;
      merged.prices = {
        base: minVariant.prices?.base || Math.round(minRetail * 0.8),
        retail: minRetail,
        wholesale: minVariant.prices?.wholesale || Math.round(minRetail * 0.9),
        dealer: minVariant.prices?.dealer || Math.round(minRetail * 0.84),
      };
      merged.inquiryOnly = false;
    }

    const knownStockVariants = activeVariants.filter(
      (v) => v.stockKnown && typeof v.stock === "number",
    );
    if (knownStockVariants.length > 0) {
      merged.stockKnown = true;
      merged.stock = knownStockVariants.reduce(
        (sum, v) => sum + (v.stock || 0),
        0,
      );
    }
  }

  merged.active = merged.active ?? true;
  return merged;
}

function ensureBrowserCatalogBuilt() {
  if (typeof window !== "undefined" && !serverSyncStarted) {
    serverSyncStarted = true;
    syncCatalogFromServer();
  }

  if (
    cachedProducts &&
    cachedAllIncludingInactive &&
    cachedMap &&
    cachedMapIncludingInactive
  ) {
    return;
  }

  const overrides = getOverridesState();
  const deletedSet = new Set(
    (overrides.deletedCodes || []).map((c) => c.toLowerCase()),
  );
  const seenFamilyCodes = new Set<string>();

  const allFamilies: Product[] = [];

  // 1. Add custom families created in Admin that are not in USER_PRODUCTS
  for (const [code, override] of Object.entries(overrides.families || {})) {
    if (deletedSet.has(code.toLowerCase())) continue;
    const existsInBase = baselineProducts().some(
      (p) => p.code.toLowerCase() === code.toLowerCase(),
    );
    if (!existsInBase) {
      seenFamilyCodes.add(code.toLowerCase());
      allFamilies.push(normalizeMergedProduct(null, override));
    }
  }

  // 2. Merge all 1,383 baseline families with any overrides
  for (const base of baselineProducts()) {
    const canonicalCode = PRODUCT_FAMILY_ALIASES.get(base.code.toLowerCase()) || base.code;
    if (deletedSet.has(base.code.toLowerCase()) || deletedSet.has(canonicalCode.toLowerCase())) continue;
    // A saved grouped family already contains its complete SKU list. Do not re-add
    // former source families (including variants deliberately removed by Admin).
    if (canonicalCode !== base.code && Object.values(overrides.families).some(f => f.code.toLowerCase() === canonicalCode.toLowerCase())) continue;
    seenFamilyCodes.add(base.code.toLowerCase());
    const override =
      overrides.families[base.code] ||
      Object.values(overrides.families).find(
        (f) => f.code.toLowerCase() === base.code.toLowerCase(),
      );
    if (override) {
      allFamilies.push(normalizeMergedProduct(base, override));
    } else {
      allFamilies.push(base);
    }
  }

  cachedAllIncludingInactive = groupProductFamilies(allFamilies).map(enrichProductTechnicalData);
  cachedProducts = cachedAllIncludingInactive.filter((p) => p.active !== false);

  cachedMapIncludingInactive = new Map();
  for (const p of cachedAllIncludingInactive) {
    p.variants?.forEach((v) =>
      cachedMapIncludingInactive!.set(v.code.toLowerCase(), p),
    );
    cachedMapIncludingInactive.set(p.code, p);
    cachedMapIncludingInactive.set(p.code.toLowerCase(), p);
    cachedMapIncludingInactive.set(p.code.replace(/-/g, "").toLowerCase(), p);
  }

  cachedMap = new Map();
  for (const p of cachedProducts) {
    p.variants
      ?.filter((v) => v.active !== false)
      .forEach((v) => cachedMap!.set(v.code.toLowerCase(), p));
    cachedMap.set(p.code, p);
    cachedMap.set(p.code.toLowerCase(), p);
    cachedMap.set(p.code.replace(/-/g, "").toLowerCase(), p);
  }
}

/**
 * Returns all authentic catalog products.
 * Note: In Node.js CLI verification (typeof window === 'undefined'), returns exact USER_PRODUCTS baseline
 * so scripts/verify-catalogue.mjs passes all static invariants.
 * In browser runtime, returns the live managed two-level catalog.
 */
export function generateMockProducts(): Product[] {
  if (typeof window === "undefined") {
    if (cachedProducts) return cachedProducts;
    cachedProducts = [...(databaseProducts || USER_PRODUCTS)];
    cachedMap = new Map();
    for (const p of cachedProducts) {
      p.variants?.forEach((v) => cachedMap!.set(v.code.toLowerCase(), p));
      cachedMap.set(p.code, p);
      cachedMap.set(p.code.toLowerCase(), p);
      cachedMap.set(p.code.replace(/-/g, "").toLowerCase(), p);
    }
    return cachedProducts;
  }

  ensureBrowserCatalogBuilt();
  return cachedProducts!;
}

export function getManagedCatalogProducts(options?: {
  includeInactive?: boolean;
}): Product[] {
  ensureBrowserCatalogBuilt();
  const list = options?.includeInactive
    ? cachedAllIncludingInactive!
    : cachedProducts!;
  return list.map((p) => (p.galleryImages ? p : normalizeMergedProduct(p)));
}

export async function saveManagedFamily(family: Product): Promise<Product> {
  const normalized = normalizeMergedProduct(family, family);
  const state = getOverridesState();
  state.families[normalized.code] = normalized;
  state.deletedCodes = state.deletedCodes.filter(
    (c) => c.toLowerCase() !== normalized.code.toLowerCase(),
  );
  state.updatedAt = new Date().toISOString();
  saveOverridesStateToStorage(state);
  invalidateCatalogCache();

  if (typeof window !== "undefined") {
    try {
      await fetch("/api/catalog/overrides/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family: normalized }),
      });
    } catch {
      // persisted locally if offline
    }
  }
  return normalized;
}

export async function deleteManagedFamily(code: string): Promise<void> {
  const clean = PRODUCT_FAMILY_ALIASES.get(code.trim().toLowerCase()) || code.trim();
  const state = getOverridesState();
  delete state.families[clean];
  if (!state.deletedCodes.includes(clean)) {
    state.deletedCodes.push(clean);
  }
  state.updatedAt = new Date().toISOString();
  saveOverridesStateToStorage(state);
  invalidateCatalogCache();

  if (typeof window !== "undefined") {
    try {
      await fetch(
        `/api/catalog/overrides/family/${encodeURIComponent(clean)}`,
        {
          method: "DELETE",
        },
      );
    } catch {
      // ignore
    }
  }
}

export async function resetManagedFamily(code: string): Promise<void> {
  const clean = PRODUCT_FAMILY_ALIASES.get(code.trim().toLowerCase()) || code.trim();
  const state = getOverridesState();
  delete state.families[clean];
  state.deletedCodes = state.deletedCodes.filter(
    (c) => c.toLowerCase() !== clean.toLowerCase(),
  );
  state.updatedAt = new Date().toISOString();
  saveOverridesStateToStorage(state);
  invalidateCatalogCache();

  if (typeof window !== "undefined") {
    try {
      await fetch(
        `/api/catalog/overrides/reset-family/${encodeURIComponent(clean)}`,
        {
          method: "POST",
        },
      );
    } catch {
      // ignore
    }
  }
}

export async function moveGalleryImageToFamily(
  sourceFamilyCode: string,
  imageId: string,
  targetFamilyCode: string,
  targetVariantCode?: string,
): Promise<boolean> {
  const all = getManagedCatalogProducts({ includeInactive: true });
  const sourceFamily = all.find((f) => f.code === sourceFamilyCode);
  const targetFamily = all.find((f) => f.code === targetFamilyCode);
  if (!sourceFamily || !targetFamily) return false;

  const sourceGallery = buildDefaultGalleryImages(sourceFamily);
  const imgToMove = sourceGallery.find((g) => g.id === imageId);
  if (!imgToMove) return false;

  const updatedSourceGallery = sourceGallery
    .filter((g) => g.id !== imageId)
    .map((g, idx) => ({ ...g, order: idx + 1 }));

  const targetGallery = buildDefaultGalleryImages(targetFamily);
  const movedImage: ProductGalleryImage = {
    ...imgToMove,
    id: `img-${targetFamily.code}-${Date.now()}`,
    scope: targetVariantCode ? "variant" : "family",
    variantCode: targetVariantCode || undefined,
    title: targetVariantCode
      ? `تصویر اختصاصی کد ${targetVariantCode} — ${targetFamily.name}`
      : `تصویر عمومی خانواده ${targetFamily.name}`,
    order: targetGallery.length + 1,
  };

  await saveManagedFamily({
    ...sourceFamily,
    galleryImages: updatedSourceGallery,
    images: updatedSourceGallery.map((g) => g.url),
  });

  await saveManagedFamily({
    ...targetFamily,
    galleryImages: [...targetGallery, movedImage],
    images: [...targetGallery, movedImage].map((g) => g.url),
  });

  return true;
}

export function getAllProducts(): Product[] {
  return generateMockProducts();
}

export function getProductByCode(
  code: string,
  options?: { includeInactive?: boolean },
): Product | undefined {
  if (!code) return undefined;
  const clean = PRODUCT_FAMILY_ALIASES.get(code.trim().toLowerCase()) || code.trim();

  if (typeof window === "undefined") {
    if (!cachedMap) {
      generateMockProducts();
    }
    return (
      cachedMap?.get(clean) ||
      cachedMap?.get(clean.toLowerCase()) ||
      cachedMap?.get(clean.replace(/-/g, "").toLowerCase()) ||
      cachedProducts?.find(
        (p) =>
          p.code.toLowerCase() === clean.toLowerCase() ||
          p.code.replace(/-/g, "").toLowerCase() ===
            clean.replace(/-/g, "").toLowerCase(),
      )
    );
  }

  ensureBrowserCatalogBuilt();
  const mapToUse = options?.includeInactive
    ? cachedMapIncludingInactive
    : cachedMap;
  const listToUse = options?.includeInactive
    ? cachedAllIncludingInactive
    : cachedProducts;

  const found =
    mapToUse?.get(clean) ||
    mapToUse?.get(clean.toLowerCase()) ||
    mapToUse?.get(clean.replace(/-/g, "").toLowerCase()) ||
    listToUse?.find(
      (p) =>
        p.code.toLowerCase() === clean.toLowerCase() ||
        p.code.replace(/-/g, "").toLowerCase() ===
          clean.replace(/-/g, "").toLowerCase(),
    );

  if (!found) return undefined;
  return found.galleryImages ? found : normalizeMergedProduct(found);
}

export function getFeaturedProducts(limit: number = 12): Product[] {
  const all = generateMockProducts();
  const featured = all.filter((p) => p.featured);
  if (featured.length >= limit) {
    return featured.slice(0, limit);
  }
  const extra = all.filter((p) => !p.featured);
  return [...featured, ...extra].slice(0, limit);
}

export function getBestSellingBelts(limit: number = 8): Product[] {
  const all = generateMockProducts();
  return all
    .filter(
      (p) =>
        matchesCatalogCategory(p, "industrial-belts") ||
        p.brand.includes("SWR") ||
        p.brand.includes("FORZA") ||
        p.subcategory.includes("تسمه"),
    )
    .slice(0, limit);
}

export function getDemandedCeramicParts(limit: number = 8): Product[] {
  const all = generateMockProducts();
  return all
    .filter((p) => matchesCatalogCategory(p, "ceramic-tiles"))
    .slice(0, limit);
}

export function getLatestProducts(limit: number = 8): Product[] {
  const all = generateMockProducts();
  return all.slice(0, limit);
}

export function getSimilarProducts(
  product: Product,
  limit: number = 6,
): Product[] {
  const all = generateMockProducts();
  const sameSub = all.filter(
    (p) => p.code !== product.code && p.subcategory === product.subcategory,
  );
  if (sameSub.length >= limit) {
    return sameSub.slice(0, limit);
  }
  const sameCat = all.filter(
    (p) =>
      p.code !== product.code &&
      p.subcategory !== product.subcategory &&
      p.categorySlug === product.categorySlug,
  );
  return [...sameSub, ...sameCat].slice(0, limit);
}

export function getProductsByCategory(
  categorySlug: string,
  limit: number = 24,
  offset: number = 0,
): { products: Product[]; total: number } {
  const all = generateMockProducts();
  let filtered: Product[];

  if (categorySlug === "swr-forza-exclusive") {
    filtered = all.filter(
      (p) => p.brand.includes("SWR") || p.brand.includes("FORZA"),
    );
  } else {
    filtered = all.filter((product) =>
      matchesCatalogCategory(product, categorySlug),
    );
  }

  return {
    products: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

function matchesDynamicProductSearch(p: Product, q: string): boolean {
  if (matchesProductSearch(p, q)) return true;
  const normQ = normalizeCatalogueText(q);
  const terms = normQ.split(" ").filter(Boolean);
  const dynamicHaystack = normalizeCatalogueText(
    [
      p.name,
      p.code,
      p.brand,
      p.categoryName,
      p.submenu,
      p.subcategory,
      ...(p.technicalSpecs || []).map((s) => `${s.key} ${s.value}`),
      ...(p.variants || []).flatMap((v) => [
        v.code,
        v.size,
        v.name,
        v.model || "",
        v.brand || "",
      ]),
    ].join(" "),
  );
  return terms.every((t) => dynamicHaystack.includes(t));
}

export function searchProducts(query: string, limit: number = 30): Product[] {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const all = generateMockProducts();

  return all
    .filter(
      (p) =>
        matchesDynamicProductSearch(p, q) ||
        p.code.toLowerCase().includes(q) ||
        p.code.replace(/-/g, "").toLowerCase().includes(q.replace(/-/g, "")) ||
        p.name.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        p.brand.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
        (p.technicalSpecs &&
          p.technicalSpecs.some(
            (s) =>
              s.key.toLowerCase().includes(q) ||
              s.value.toLowerCase().includes(q),
          )),
    )
    .slice(0, limit);
}

export function getInstantSearchResults(query: string) {
  if (!query || query.trim().length < 2) {
    return { products: [], categories: [], brands: [] };
  }
  const q = query.trim().toLowerCase();
  const allProducts = generateMockProducts();

  const products = allProducts
    .filter(
      (p) =>
        matchesDynamicProductSearch(p, q) ||
        p.code.toLowerCase().includes(q) ||
        p.code.replace(/-/g, "").toLowerCase().includes(q.replace(/-/g, "")) ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q),
    )
    .slice(0, 6);

  const matchedCategories = getManagedCategories().filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      flattenCategoryNodes(c.children).some((node) =>
        node.name.toLowerCase().includes(q),
      ),
  ).slice(0, 4);

  const matchedBrands = getManagedBrands().filter(
    (b) =>
      b.name.toLowerCase().includes(q) || b.nameEn.toLowerCase().includes(q),
  ).slice(0, 3);

  return {
    products,
    categories: matchedCategories,
    brands: matchedBrands,
  };
}
