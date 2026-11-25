import type { Express, Request, Response } from 'express';
import { database, databaseEnabled } from './db/connection';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../src/data/approvedMenuFallback';
import type { Category, Product, ProductGalleryImage, ProductVariant } from '../src/types';

const ENGINEERED_SOURCE_PATH = 'github/javanwebi/POPD/server/data/engineeredCatalog.json';
const E869_SOURCE_PATH = 'github/javanwebi/POPD/deliverables/catalog-869-audit/e869_linked_catalog.json';
const CACHE_TTL_MS = 45_000;

type AliasRecord = { newFamilyCode?: string; directSkuCode?: string };
type ReferenceDirectSku = {
  skuCode: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  subcategory: string;
  brand: string;
  imageUrl: string | null;
  technicalSpecs: unknown[];
  priceSnapshot: Record<string, unknown>;
  sourceFamilyCode: string | null;
  active: boolean;
};
type NavigationGroup = {
  id: string;
  title: string;
  iconKey?: string;
  imageUrl: string | null;
  categorySlugs: string[];
  sortOrder: number;
  active: boolean;
};
type Snapshot = {
  loadedAt: number;
  products: Product[];
  directSkus: ReferenceDirectSku[];
  categories: Category[];
  groups: NavigationGroup[];
  productByCode: Map<string, Product>;
  productByVariantCode: Map<string, Product>;
  aliasMap: Map<string, AliasRecord>;
  assignmentsByFamily: Map<string, { categorySlug: string; submenuName: string; leafName: string | null; method?: string }>;
  directSkuAssignments: Array<{ categorySlug: string; submenuName: string | null; leafName: string | null }>;
  sourceSha256: string | null;
  e869SourceSha256: string | null;
  linkedE869ImageCount: number;
  importedAt: string | null;
  generatedAt: string | null;
  familyCount: number;
  skuCount: number;
  quarantinedSkuCount: number;
  rawDirectSkuCount: number;
  standaloneDirectSkuRows: number;
  verifiedFamilyImageCount: number;
  verifiedVariantImageCount: number;
};

let snapshotCache: Snapshot | null = null;
let snapshotInFlight: Promise<Snapshot> | null = null;

function normalizeCode(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toman(amount: unknown, currency: unknown): number {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return String(currency || '').toUpperCase() === 'IRR' ? Math.round(numeric / 10) : Math.round(numeric);
}

function isLegacyCatalogEUrl(url: string): boolean {
  return /\/storage\/products\/(catalog|thumbs)\/e\(\d+\)\.(png|webp)/i.test(url);
}

function isAuditedBeltProduct(product: Product): boolean {
  const slug = product.resolvedAssignment?.categorySlug || product.categorySlug;
  const audited = new Set(['excel-v2-1-1', 'excel-v2-1-2', 'excel-v2-1-3', 'excel-v2-1-5']);
  if (audited.has(slug)) return true;
  if (slug === 'excel-v2-1-4') {
    const identityText = String(product.name || '') + ' ' + String(product.resolvedAssignment?.submenuName || '');
    return !/دستگاه|قیچی|هویه|گیره/.test(identityText);
  }
  return false;
}

function makeGalleryImage(row: any): ProductGalleryImage {
  return {
    id: String(row.id),
    url: String(row.url || ''),
    fileName: String(row.file_name || ''),
    scope: row.scope === 'variant' ? 'variant' : 'family',
    familyCode: row.family_code ? String(row.family_code) : undefined,
    variantCode: row.variant_code ? String(row.variant_code) : undefined,
    identityVerified: row.identity_verified === true,
    title: String(row.title || ''),
    order: Number(row.sort_order) || 0,
  };
}

async function loadSnapshot(): Promise<Snapshot> {
  if (!databaseEnabled()) throw new Error('PostgreSQL catalog backend is not enabled');

  const db = database();
  const [archiveRes, e869Res, groupRes, categoryRes, commercialRes, galleryRes, aliasRes] = await Promise.all([
    db.query(
      'select payload, sha256, imported_at from app_private.source_archives where source_path = $1 order by imported_at desc limit 1',
      [ENGINEERED_SOURCE_PATH],
    ),
    db.query(
      'select payload, sha256, imported_at from app_private.source_archives where source_path = $1 order by imported_at desc limit 1',
      [E869_SOURCE_PATH],
    ),
    db.query(
      'select id, title, icon_key as "iconKey", image_url as "imageUrl", category_slugs as "categorySlugs", sort_order as "sortOrder", is_active as active from public.catalog_navigation_groups where is_active = true order by sort_order, id',
    ),
    db.query(
      'select id, slug, name, icon, image_url as image, description, sort_order as "sortOrder", is_active as active, metadata from public.catalog_categories where is_active = true order by sort_order, name',
    ),
    db.query(
      'select variant_code, price, base_price, retail_price, wholesale_price, dealer_price, stock, stock_reserved, stock_known, inquiry_only, currency from public.variant_commercial_specs',
    ),
    db.query(
      `select
        gi.id,
        gi.family_code,
        gi.variant_code,
        gi.file_name,
        gi.url,
        gi.scope,
        gi.title,
        gi.sort_order,
        gi.identity_verified
      from public.catalog_gallery_images gi
      inner join public.catalog_image_audits ia
        on lower(ia.image_url) = lower(gi.url)
      where gi.scope = 'family-example'
        and gi.identity_verified = true
        and ia.review_status = 'approved'
        and ia.identity_status = 'verified'
        and ia.sku_verified = false
        and upper(ia.family_code) = upper(gi.family_code)
      order by gi.sort_order, gi.id`,
    ),
    db.query(
      'select old_family_code, new_family_code, direct_sku_code from public.catalog_family_aliases',
    ),
  ]);

  const archive = archiveRes.rows[0];
  if (!archive) throw new Error('The POPD engineered catalog archive is missing from app_private.source_archives');
  const payload = typeof archive.payload === 'string' ? JSON.parse(archive.payload) : archive.payload;
  if (!payload || !Array.isArray(payload.products)) throw new Error('The POPD engineered catalog archive has an invalid payload');

  const e869Archive = e869Res.rows[0];
  if (!e869Archive) throw new Error('The POPD e869 linked SKU image archive is missing from app_private.source_archives');
  const e869Payload = typeof e869Archive.payload === 'string' ? JSON.parse(e869Archive.payload) : e869Archive.payload;
  const e869Assignments = asArray<any>(e869Payload?.assignments);
  const e869ImageBySku = new Map<string, string>();
  const e869ImageUrls = new Set<string>();
  for (const assignment of e869Assignments) {
    const skuCode = normalizeCode(assignment?.skuCode);
    const imageUrl = String(assignment?.url || '').trim();
    const imageNumberMatch = imageUrl.match(/^\/storage\/products\/catalog\/e\((\d+)\)\.png$/i);
    const imageNumber = imageNumberMatch ? Number(imageNumberMatch[1]) : 0;
    if (
      assignment?.targetKind !== 'variant' ||
      !skuCode ||
      !Number.isInteger(imageNumber) ||
      imageNumber < 1 ||
      imageNumber > 869
    ) {
      throw new Error('The POPD e869 image mapping contains an invalid SKU or image URL');
    }
    const imageUrlKey = normalizeCode(imageUrl);
    if (e869ImageBySku.has(skuCode) || e869ImageUrls.has(imageUrlKey)) {
      throw new Error('The POPD e869 image mapping contains a duplicate SKU or image URL: ' + skuCode);
    }
    e869ImageBySku.set(skuCode, imageUrl);
    e869ImageUrls.add(imageUrlKey);
  }
  if (
    Number(e869Payload?.totalImages) !== 869 ||
    Number(e869Payload?.linkedImages) !== 869 ||
    Number(e869Payload?.uniqueSkusLinked) !== 869 ||
    e869Assignments.length !== 869 ||
    e869ImageBySku.size !== 869 ||
    e869ImageUrls.size !== 869
  ) {
    throw new Error('The POPD e869 linked image mapping failed its 869-image uniqueness check');
  }

  const fallbackCategories = APPROVED_MENU_CATEGORIES as unknown as Category[];
  const fallbackGroups = APPROVED_MENU_GROUPS as unknown as NavigationGroup[];
  const fallbackCategoriesBySlug = new Map(fallbackCategories.map((category) => [category.slug, category]));
  const categoryRowsBySlug = new Map(categoryRes.rows.map((row: any) => [String(row.slug), row]));
  const groupRowsById = new Map(groupRes.rows.map((row: any) => [String(row.id), row]));

  // The fallback file is a last-known-good source and currently contains 34 entries.
  // Supabase is the active 40-category authority; never drop categories added after
  // that fallback snapshot or reject families assigned to those valid active slugs.
  const activeCategorySlugs = categoryRes.rows.length
    ? categoryRes.rows.map((row: any) => normalizeCode(row.slug)).filter(Boolean)
    : fallbackCategories.map((category) => normalizeCode(category.slug));
  const categorySlugs = new Set(activeCategorySlugs);

  if (categoryRes.rows.length && fallbackCategories.some((category) => !categoryRowsBySlug.has(category.slug))) {
    throw new Error('Supabase active categories are missing an approved fallback category');
  }
  if (groupRes.rows.length && fallbackGroups.some((group) => !groupRowsById.has(group.id))) {
    throw new Error('Supabase active navigation groups do not fully match the approved POPD menu taxonomy');
  }

  const activeGroupCategorySlugs = new Set(
    groupRes.rows.flatMap((row: any) => asArray<string>(row.categorySlugs).map(normalizeCode)),
  );
  if (categoryRes.rows.length && groupRes.rows.length) {
    const ungrouped = activeCategorySlugs.filter((slug) => !activeGroupCategorySlugs.has(slug));
    const unknownGroupCategories = Array.from(activeGroupCategorySlugs).filter((slug) => !categorySlugs.has(slug));
    if (ungrouped.length || unknownGroupCategories.length) {
      throw new Error(
        'Supabase catalogue navigation does not cover the active category set: ' +
        JSON.stringify({ ungrouped, unknownGroupCategories }),
      );
    }
  }

  const productByCode = new Map<string, Product>();
  const productByVariantCode = new Map<string, Product>();
  const assignmentsByFamily = new Map<string, { categorySlug: string; submenuName: string; leafName: string | null; method?: string }>();
  const menuStats = new Map<string, { familyCount: number; skuCount: number }>();
  const skuCodes = new Set<string>();
  const products = payload.products as Product[];

  // resolvedAssignment is the page-level authority. catalog_targets.json is a prior audit projection
  // and differs for some SKUs after canonical family reclassification.
  for (const product of products) {
    const assignment = product.resolvedAssignment;
    const slug = normalizeCode(assignment?.categorySlug);
    if (!assignment || !product.code || !slug || !categorySlugs.has(slug)) {
      throw new Error('A canonical POPD family is missing a valid resolved category assignment: ' + String(product.code || 'unknown'));
    }
    product.categorySlug = slug;
    const category = categoryRowsBySlug.get(slug);
    if (category?.name) product.categoryName = String(category.name);
    product.submenu = assignment.submenuName || product.submenu;
    product.subcategory = assignment.leafName || product.subcategory;
    assignmentsByFamily.set(product.code, {
      categorySlug: slug,
      submenuName: assignment.submenuName || '',
      leafName: assignment.leafName || null,
      method: assignment.method || 'engineering_audited',
    });

    productByCode.set(normalizeCode(product.code), product);
    for (const variant of product.variants || []) {
      const code = normalizeCode(variant.code);
      if (!code) throw new Error('A canonical POPD variant has an empty code in family ' + product.code);
      if (skuCodes.has(code)) throw new Error('Duplicate SKU code in engineered POPD catalog: ' + code);
      skuCodes.add(code);
      productByVariantCode.set(code, product);
    }
    const stats = menuStats.get(slug) || { familyCount: 0, skuCount: 0 };
    stats.familyCount += 1;
    stats.skuCount += product.variants?.length || 0;
    menuStats.set(slug, stats);
  }

  const missingActiveE869Skus = Array.from(e869ImageBySku.keys()).filter((code) => !productByVariantCode.has(code));
  if (missingActiveE869Skus.length) {
    throw new Error('The POPD e869 image map contains SKUs missing from the active catalogue: ' + missingActiveE869Skus.slice(0, 20).join(', '));
  }

  const expectedSkuCount = Number(payload.stats?.validSkus || 0);
  if (expectedSkuCount && skuCodes.size !== expectedSkuCount) {
    throw new Error('Engineered POPD SKU integrity check failed: expected ' + expectedSkuCount + ', found ' + skuCodes.size);
  }
  const sourceSkuCount = Number(payload.stats?.sourceSkus || 0);
  const quarantinedSkuCount = Number(payload.stats?.quarantinedSkus || 0);
  if (sourceSkuCount && skuCodes.size + quarantinedSkuCount !== sourceSkuCount) {
    throw new Error('Engineered POPD source/quarantine totals do not reconcile');
  }

  const aliases = new Map<string, AliasRecord>();
  for (const entry of asArray<any>(payload.aliases)) {
    if (Array.isArray(entry) && entry.length >= 2) aliases.set(normalizeCode(entry[0]), entry[1] || {});
  }

  const commercialByVariant = new Map<string, {
    prices: { base: number; retail: number; wholesale: number; dealer: number };
    price: number;
    stock: number;
    stockKnown: boolean;
    inquiryOnly: boolean;
  }>();
  for (const row of commercialRes.rows) {
    const code = normalizeCode(row.variant_code);
    if (!code) continue;
    const retail = toman(row.retail_price || row.price, row.currency);
    commercialByVariant.set(code, {
      prices: {
        base: toman(row.base_price, row.currency),
        retail,
        wholesale: toman(row.wholesale_price, row.currency),
        dealer: toman(row.dealer_price, row.currency),
      },
      price: retail,
      stock: Math.max(0, Number(row.stock || 0) - Number(row.stock_reserved || 0)),
      stockKnown: row.stock_known === true,
      inquiryOnly: row.inquiry_only !== false,
    });
  }

  const legacyCodesByCanonical = new Map<string, string[]>();
  for (const alias of aliasRes.rows) {
    const oldCode = normalizeCode(alias.old_family_code);
    const newCode = normalizeCode(alias.new_family_code);
    if (!oldCode || !newCode) continue;
    legacyCodesByCanonical.set(newCode, [
      ...(legacyCodesByCanonical.get(newCode) || []),
      oldCode,
    ]);
  }

  const galleryByFamily = new Map<string, ProductGalleryImage[]>();
  for (const row of galleryRes.rows) {
    const entry = makeGalleryImage(row);
    if (!entry.url || !row.family_code) continue;
    const key = normalizeCode(row.family_code);
    galleryByFamily.set(key, [...(galleryByFamily.get(key) || []), entry]);
  }

  // Build a canonical ownership map for family images. A URL shared by two
  // different canonical families is ambiguous and must not appear on either.
  const canonicalFamilyByCode = new Map<string, string>();
  for (const product of products) {
    const canonicalCode = normalizeCode(product.code);
    if (!canonicalCode) continue;
    canonicalFamilyByCode.set(canonicalCode, canonicalCode);
    for (const legacyCode of product.legacyFamilyCodes || []) {
      const legacyKey = normalizeCode(legacyCode);
      if (legacyKey) canonicalFamilyByCode.set(legacyKey, canonicalCode);
    }
  }
  for (const [canonicalCode, legacyCodes] of legacyCodesByCanonical) {
    for (const legacyCode of legacyCodes) {
      canonicalFamilyByCode.set(legacyCode, canonicalCode);
    }
  }

  const familyImageOwnersByUrl = new Map<string, Set<string>>();
  const addFamilyImageOwner = (url: unknown, familyCode: unknown, canonicalOverride?: string) => {
    const urlKey = normalizeCode(url);
    const familyKey = normalizeCode(familyCode);
    const canonicalCode = canonicalOverride || canonicalFamilyByCode.get(familyKey);
    if (!urlKey || !canonicalCode) return;
    const owners = familyImageOwnersByUrl.get(urlKey) || new Set<string>();
    owners.add(canonicalCode);
    familyImageOwnersByUrl.set(urlKey, owners);
  };

  // Legacy e869 files are exclusively SKU-owned. Older family-example audit rows
  // reused these URLs under unrelated family codes; never promote them to family artwork.
  for (const row of galleryRes.rows) {
    if (
      row.scope === 'family-example' &&
      row.identity_verified === true &&
      !e869ImageUrls.has(normalizeCode(row.url))
    ) {
      addFamilyImageOwner(row.url, row.family_code);
    }
  }
  for (const product of products) {
    for (const image of product.galleryImages || []) {
      if (
        image.scope === 'family' &&
        image.identityVerified === true &&
        Boolean(image.url) &&
        !isLegacyCatalogEUrl(image.url)
      ) {
        addFamilyImageOwner(image.url, product.code, normalizeCode(product.code));
      }
    }
  }

  const isUniqueFamilyImageFor = (image: ProductGalleryImage, canonicalCode: string) => {
    const owners = familyImageOwnersByUrl.get(normalizeCode(image.url));
    return Boolean(owners && owners.size === 1 && owners.has(canonicalCode));
  };

  for (const product of products) {
    const isBelt = isAuditedBeltProduct(product);
    const canonicalCode = normalizeCode(product.code);
    const matchedGallery: ProductGalleryImage[] = (product.galleryImages || []).filter(
      (image) =>
        !isBelt &&
        image.scope === 'family' &&
        image.identityVerified === true &&
        Boolean(image.url) &&
        !isLegacyCatalogEUrl(image.url) &&
        isUniqueFamilyImageFor(image, canonicalCode),
    );
    const seenUrls = new Set(matchedGallery.map((image) => image.url));

    const attachGallery = (items?: ProductGalleryImage[]) => {
      for (const image of items || []) {
        if (!image.url || seenUrls.has(image.url)) continue;
        if (!image.identityVerified) continue;
        if (e869ImageUrls.has(normalizeCode(image.url))) continue;
        if (image.scope === 'family' && !isUniqueFamilyImageFor(image, canonicalCode)) continue;
        seenUrls.add(image.url);
        matchedGallery.push(image);
      }
    };

    // Family image rows are keyed by their legacy family code. Look up those codes
    // directly; translating old -> new before the lookup loses the original row.
    const familyCandidates = new Set([
      normalizeCode(product.code),
      ...(product.legacyFamilyCodes || []).map(normalizeCode),
      ...(legacyCodesByCanonical.get(normalizeCode(product.code)) || []),
    ].filter(Boolean));
    for (const candidate of familyCandidates) {
      attachGallery(galleryByFamily.get(candidate));
    }

    const updatedVariants = (product.variants || []).map((variant) => {
      const variantKey = normalizeCode(variant.code);
      const commercial = commercialByVariant.get(variantKey);
      // POPD's e869 linked catalog is the authoritative one-to-one SKU image map.
      // Match only by the exact SKU code; a missing mapping intentionally remains image-free.
      const e869Image = e869ImageBySku.get(variantKey);
      const images = e869Image ? [e869Image] : [];
      return {
        ...variant,
        ...(commercial ? {
          prices: commercial.prices,
          price: commercial.price,
          stock: commercial.stock,
          stockKnown: commercial.stockKnown,
          inquiryOnly: commercial.inquiryOnly,
        } : {}),
        images,
      } as ProductVariant;
    });

    // Never promote raw archive image fields to family artwork: the archive's
    // first image can be a variant/SKU image. Family artwork comes only from
    // identity-verified family-scope gallery rows.
    const familyImages = Array.from(new Set(
      matchedGallery
        .filter((image) => image.scope === 'family' && image.identityVerified === true && Boolean(image.url))
        .map((image) => image.url),
    ));
    product.variants = updatedVariants;
    product.images = familyImages;
    product.image = familyImages[0] || '';
    product.galleryImages = matchedGallery;
    if (updatedVariants.length > 0) {
      product.prices = updatedVariants[0].prices || product.prices || { base: 0, retail: 0, wholesale: 0, dealer: 0 };
      product.stock = updatedVariants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
      product.stockKnown = updatedVariants.every((variant) => variant.stockKnown === true);
      product.inquiryOnly = updatedVariants.every((variant) => variant.inquiryOnly !== false);
    }
  }

  // Independent SKUs must come from the pinned POPD archive, never from the
  // legacy catalog_direct_skus projection. That table contains family-variant
  // duplicates and stale/quarantined rows which can create phantom subcategories.
  const directSkuCodes = new Set<string>();
  const directSkus: ReferenceDirectSku[] = asArray<any>(payload.directSkus)
    .filter((row) => row && row.active !== false && row.is_active !== false)
    .map((row: any) => {
      const assignment = row.resolvedAssignment || row.assignment || row;
      const skuCode = String(row.skuCode || row.sku_code || row.code || '').trim();
      const codeKey = normalizeCode(skuCode);
      const categorySlug = normalizeCode(
        assignment.categorySlug || assignment.category_slug || row.categorySlug || row.category_slug,
      );
      if (!codeKey || !categorySlug || !categorySlugs.has(categorySlug)) {
        throw new Error('A POPD standalone SKU is missing its code or valid category assignment');
      }
      if (productByVariantCode.has(codeKey)) {
        throw new Error('A POPD standalone SKU duplicates a family variant: ' + skuCode);
      }
      if (directSkuCodes.has(codeKey)) {
        throw new Error('Duplicate standalone SKU code in POPD archive: ' + skuCode);
      }
      directSkuCodes.add(codeKey);
      const category = categoryRowsBySlug.get(categorySlug) || fallbackCategoriesBySlug.get(categorySlug);
      const rawImage = String(row.imageUrl || row.image_url || '').trim();
      const verifiedImage = e869ImageBySku.get(codeKey) ||
        (row.identityVerified === true || row.identity_verified === true ? rawImage : '');
      const technicalSpecs = Array.isArray(row.technicalSpecs)
        ? row.technicalSpecs
        : Array.isArray(row.technical_specs) ? row.technical_specs : [];
      return {
        skuCode,
        name: String(row.name || row.title || skuCode),
        categorySlug,
        categoryName: String(category?.name || row.categoryName || row.category_name || ''),
        submenu: String(assignment.submenuName || assignment.submenu_name || row.submenu || '').trim(),
        subcategory: String(assignment.leafName || assignment.leaf_name || row.subcategory || '').trim(),
        brand: String(row.brand || ''),
        imageUrl: verifiedImage || null,
        technicalSpecs,
        priceSnapshot: {},
        sourceFamilyCode: row.sourceFamilyCode || row.source_family_code
          ? String(row.sourceFamilyCode || row.source_family_code)
          : null,
        active: true,
      };
    });
  const directSkuAssignments = directSkus.map((item) => ({
    categorySlug: normalizeCode(item.categorySlug),
    submenuName: item.submenu || null,
    leafName: item.subcategory || null,
  }));
  const directSkuCounts = new Map<string, number>();
  for (const direct of directSkuAssignments) {
    directSkuCounts.set(direct.categorySlug, (directSkuCounts.get(direct.categorySlug) || 0) + 1);
  }

  const categoryRows = categoryRes.rows.length
    ? categoryRes.rows
    : fallbackCategories.map((category) => ({
        ...category,
        active: category.active !== false,
        metadata: {},
      }));

  const categories = categoryRows.map((dbCategory: any) => {
    const slug = String(dbCategory.slug || '');
    const fallback = fallbackCategoriesBySlug.get(slug);
    const metadata = dbCategory.metadata && typeof dbCategory.metadata === 'object'
      ? dbCategory.metadata as Record<string, unknown>
      : {};
    const hasMetadataChildren = Array.isArray(metadata.children);
    const metadataChildren = hasMetadataChildren
      ? metadata.children as Category['children']
      : [];
    const children = hasMetadataChildren ? metadataChildren : (fallback?.children || []);
    const metadataSubcategoriesRaw = metadata.subcategories;
    const hasMetadataSubcategories = Array.isArray(metadataSubcategoriesRaw);
    const metadataSubcategories = hasMetadataSubcategories
      ? (metadataSubcategoriesRaw as unknown[]).map((value: unknown) => String(value))
      : [];
    const subcategories = hasMetadataSubcategories
      ? metadataSubcategories
      : fallback?.subcategories?.length
        ? fallback.subcategories
        : (children || []).map((node) => node.name);
    const stats = menuStats.get(slug) || { familyCount: 0, skuCount: 0 };
    const directSkuCount = directSkuCounts.get(slug) || 0;
    const rawId = Number(dbCategory.id);
    return {
      ...(fallback || {}),
      id: fallback?.id ?? (Number.isFinite(rawId) ? rawId : Number(dbCategory.sortOrder) || 0),
      slug,
      name: String(dbCategory.name || fallback?.name || slug),
      nameEn: fallback?.nameEn || '',
      description: (dbCategory.description && String(dbCategory.description).trim()) || fallback?.description || '',
      subcategories,
      icon: dbCategory.icon || fallback?.icon || 'Package',
      image: dbCategory.image || fallback?.image || undefined,
      children,
      menuSource: (typeof metadata.source === 'string' ? metadata.source : undefined) || fallback?.menuSource,
      sortOrder: Number(dbCategory.sortOrder ?? fallback?.sortOrder ?? 0),
      count: stats.familyCount,
      familyCount: stats.familyCount,
      directSkuCount,
      skuCount: stats.skuCount + directSkuCount,
      active: dbCategory.active !== false,
    } as Category;
  });

  const groups = fallbackGroups.map((group) => {
    const dbGroup = groupRowsById.get(group.id);
    const dbCategorySlugs = asArray<string>(dbGroup?.categorySlugs).map(String);
    const categorySlugsForGroup = dbCategorySlugs.length
      ? dbCategorySlugs
      : activeCategorySlugs.filter((slug) => slug.startsWith(`${group.id}-`));
    return {
      ...group,
      title: dbGroup?.title || group.title,
      iconKey: dbGroup?.iconKey || group.iconKey,
      imageUrl: dbGroup?.imageUrl || group.imageUrl || null,
      categorySlugs: categorySlugsForGroup,
      sortOrder: Number(dbGroup?.sortOrder ?? group.sortOrder ?? 0),
      active: true,
    };
  });

  // Count only images that actually survive ownership checks and are attached to
  // active family/SKU records; audited-but-unassigned archive rows stay hidden.
  const activeVerifiedFamilyImageUrls = new Set<string>();
  const activeVerifiedVariantImageUrls = new Set<string>();
  for (const product of products) {
    for (const url of product.images || []) {
      if (url) activeVerifiedFamilyImageUrls.add(url);
    }
    for (const variant of product.variants || []) {
      for (const url of variant.images || []) {
        if (url) activeVerifiedVariantImageUrls.add(url);
      }
    }
  }

  return {
    loadedAt: Date.now(),
    products,
    directSkus,
    categories,
    groups,
    productByCode,
    productByVariantCode,
    aliasMap: aliases,
    assignmentsByFamily,
    directSkuAssignments,
    sourceSha256: archive.sha256 ? String(archive.sha256) : null,
    e869SourceSha256: e869Archive.sha256 ? String(e869Archive.sha256) : null,
    linkedE869ImageCount: activeVerifiedVariantImageUrls.size,
    importedAt: archive.imported_at ? new Date(archive.imported_at).toISOString() : null,
    generatedAt: payload.generatedAt ? String(payload.generatedAt) : null,
    familyCount: products.length,
    skuCount: skuCodes.size,
    quarantinedSkuCount,
    rawDirectSkuCount: Number(payload.stats?.directSkus || 0),
    standaloneDirectSkuRows: directSkuAssignments.length,
    verifiedFamilyImageCount: activeVerifiedFamilyImageUrls.size,
    verifiedVariantImageCount: activeVerifiedVariantImageUrls.size,
  };
}

async function getSnapshot(): Promise<Snapshot> {
  if (snapshotCache && Date.now() - snapshotCache.loadedAt < CACHE_TTL_MS) return snapshotCache;
  if (!snapshotInFlight) {
    snapshotInFlight = loadSnapshot()
      .then((snapshot) => { snapshotCache = snapshot; return snapshot; })
      .finally(() => { snapshotInFlight = null; });
  }
  return snapshotInFlight;
}

function buildReferenceCategoryChildren(
  entries: Array<{ submenu: string | null; leaf: string | null }>,
): NonNullable<Category['children']> {
  const bySubmenu = new Map<string, { name: string; children: Array<{ name: string }> }>();
  for (const entry of entries) {
    const submenu = String(entry.submenu || entry.leaf || '').trim();
    if (!submenu) continue;
    let parent = bySubmenu.get(normalizeCode(submenu));
    if (!parent) {
      parent = { name: submenu, children: [] };
      bySubmenu.set(normalizeCode(submenu), parent);
    }
    const leaf = String(entry.leaf || '').trim();
    if (leaf && normalizeCode(leaf) !== normalizeCode(submenu) &&
        !parent.children.some((child) => normalizeCode(child.name) === normalizeCode(leaf))) {
      parent.children.push({ name: leaf });
    }
  }
  return Array.from(bySubmenu.values());
}

function referenceCategoryTaxonomy(snapshot: Snapshot, category: Category): Category {
  const familyAssignments = snapshot.products.flatMap((product) => {
    const assignment = snapshot.assignmentsByFamily.get(product.code);
    if (!assignment || assignment.categorySlug !== category.slug) return [];
    return [{
      submenu: assignment.submenuName || null,
      leaf: assignment.leafName || null,
    }];
  });
  const directSkuAssignments = snapshot.directSkuAssignments
    .filter((item) => item.categorySlug === category.slug)
    .map((item) => ({ submenu: item.submenuName, leaf: item.leafName }));
  const children = buildReferenceCategoryChildren([...familyAssignments, ...directSkuAssignments]);

  // The same resolved POPD assignments drive both the category index and its
  // detail page. An empty result is intentional: never resurrect stale DB nodes.
  return {
    ...category,
    children,
    subcategories: children.map((node) => node.name),
  };
}

function categoryPayload(snapshot: Snapshot, slug: string) {
  const category = snapshot.categories.find((item) => item.slug === slug);
  if (!category) return null;
  const matchedProducts: Product[] = [];
  const families: Array<{ code: string; name: string; brand: string; submenu: string | null; leaf: string | null; skuCount: number }> = [];
  for (const product of snapshot.products) {
    const assignment = snapshot.assignmentsByFamily.get(product.code);
    if (!assignment || assignment.categorySlug !== slug) continue;
    families.push({
      code: product.code,
      name: product.name,
      brand: String(product.brand || ''),
      submenu: assignment.submenuName || null,
      leaf: assignment.leafName || null,
      skuCount: product.variants?.length || 0,
    });
    matchedProducts.push({
      ...product,
      galleryImages: (product.galleryImages || []).slice(0, 4),
      variants: (product.variants || []).map((variant) => ({
        ...variant,
        images: variant.images?.slice(0, 1),
      })),
    });
  }
  const categoryWithReferenceTaxonomy = referenceCategoryTaxonomy(snapshot, category);
  return {
    category: categoryWithReferenceTaxonomy,
    families,
    products: matchedProducts,
    directSkus: snapshot.directSkus.filter((item) => item.categorySlug === slug),
  };
}

function legacyCategoryPayload(snapshot: Snapshot, slug: string) {
  const category = snapshot.categories.find((item) => item.slug === slug);
  if (!category) return null;
  const products = snapshot.products.filter(
    (product) => product.categorySlug === slug || product.resolvedAssignment?.categorySlug === slug,
  );
  return { category, products };
}

function productPayload(snapshot: Snapshot, rawCode: string) {
  const code = normalizeCode(rawCode);
  let product = snapshot.productByCode.get(code) || snapshot.productByVariantCode.get(code);
  if (!product) {
    const alias = snapshot.aliasMap.get(code);
    if (alias?.newFamilyCode) product = snapshot.productByCode.get(normalizeCode(alias.newFamilyCode));
    else if (alias?.directSkuCode) product = snapshot.productByVariantCode.get(normalizeCode(alias.directSkuCode));
  }
  if (!product) return null;
  const targetSlug = product.resolvedAssignment?.categorySlug || product.categorySlug;
  const similarProducts = snapshot.products
    .filter((candidate) => candidate.code !== product!.code && (candidate.resolvedAssignment?.categorySlug || candidate.categorySlug) === targetSlug)
    .slice(0, 4)
    .map((candidate) => ({ ...candidate, variants: (candidate.variants || []).slice(0, 3) }));
  const approvedCategory = snapshot.categories.find((category) => category.slug === targetSlug);
  return {
    product,
    categoryMeta: approvedCategory
      ? { slug: approvedCategory.slug, name: approvedCategory.name }
      : { slug: product.categorySlug, name: product.categoryName },
    similarProducts,
  };
}

async function withSnapshot(
  res: Response,
  operation: (snapshot: Snapshot) => Record<string, unknown>,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const snapshot = await getSnapshot();
    res.json({ success: true, ...operation(snapshot), sourceRevision: snapshot.sourceSha256 });
  } catch (error) {
    console.error('[catalog-reference-api]', error);
    res.status(503).json({ success: false, message: 'داده مرجع کاتالوگ در Supabase در دسترس نیست.' });
  }
}

export function registerCatalogReferenceApi(app: Express): void {
  app.get('/api/catalog/reference/status', async (_req: Request, res: Response) => {
    await withSnapshot(res, (snapshot) => ({
      sourcePath: ENGINEERED_SOURCE_PATH,
      sourceSha256: snapshot.sourceSha256,
      e869SourcePath: E869_SOURCE_PATH,
      e869SourceSha256: snapshot.e869SourceSha256,
      linkedE869ImageCount: snapshot.linkedE869ImageCount,
      importedAt: snapshot.importedAt,
      generatedAt: snapshot.generatedAt,
      familyCount: snapshot.familyCount,
      skuCount: snapshot.skuCount,
      categoryCount: snapshot.categories.length,
      groupCount: snapshot.groups.length,
      quarantinedSkuCount: snapshot.quarantinedSkuCount,
      rawDirectSkuCount: snapshot.rawDirectSkuCount,
      standaloneDirectSkuRows: snapshot.standaloneDirectSkuRows,
      verifiedFamilyImageCount: snapshot.verifiedFamilyImageCount,
      verifiedVariantImageCount: snapshot.verifiedVariantImageCount,
    }));
  });

  app.get('/api/catalog/reference/navigation-groups', async (_req: Request, res: Response) => {
    await withSnapshot(res, (snapshot) => ({ groups: snapshot.groups }));
  });

  app.get('/api/catalog/reference/categories', async (_req: Request, res: Response) => {
    await withSnapshot(res, (snapshot) => ({
      categories: snapshot.categories.map((category) => referenceCategoryTaxonomy(snapshot, category)),
    }));
  });

  app.get('/api/catalog/reference/menu-category/:slug', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const snapshot = await getSnapshot();
      const payload = categoryPayload(snapshot, String(req.params.slug || ''));
      if (!payload) { res.status(404).json({ success: false, message: 'دسته‌بندی پیدا نشد.' }); return; }
      res.json({ success: true, ...payload, sourceRevision: snapshot.sourceSha256 });
    } catch (error) {
      console.error('[catalog-reference-api]', error);
      res.status(503).json({ success: false, message: 'داده مرجع کاتالوگ در Supabase در دسترس نیست.' });
    }
  });

  app.get('/api/catalog/reference/category/:slug', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const snapshot = await getSnapshot();
      const payload = legacyCategoryPayload(snapshot, String(req.params.slug || ''));
      if (!payload) { res.status(404).json({ success: false, message: 'دسته‌بندی پیدا نشد.' }); return; }
      res.json({ success: true, ...payload, sourceRevision: snapshot.sourceSha256 });
    } catch (error) {
      console.error('[catalog-reference-api]', error);
      res.status(503).json({ success: false, message: 'داده مرجع کاتالوگ در Supabase در دسترس نیست.' });
    }
  });

  app.get('/api/catalog/reference/product/:code', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const snapshot = await getSnapshot();
      const payload = productPayload(snapshot, String(req.params.code || ''));
      if (!payload) { res.status(404).json({ success: false, message: 'خانواده یا کد کالا پیدا نشد.' }); return; }
      res.json({ success: true, ...payload, sourceRevision: snapshot.sourceSha256 });
    } catch (error) {
      console.error('[catalog-reference-api]', error);
      res.status(503).json({ success: false, message: 'داده مرجع کاتالوگ در Supabase در دسترس نیست.' });
    }
  });
}
