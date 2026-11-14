import type { Product } from '../types';
import {
  APPROVED_MENU_CATEGORIES,
  APPROVED_MENU_GROUPS,
  type ApprovedMenuGroup,
} from '../data/approvedMenuFallback';
import {
  normalizeManagedCategory,
  type CategoryNode,
  type EnhancedCategory,
} from '../data/categories';
import { getAllProducts } from '../data/mockGenerator';
import {
  CATALOG_FAMILY_MENU_ASSIGNMENTS,
  type FamilyMenuAssignment,
} from '../data/catalogMenuAssignmentsData';

const normalizeText = (value?: string | null): string =>
  (value || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function ensureCatalogFamiliesLoaded(): Product[] {
  const existing = getAllProducts();
  if (existing && existing.length > 0) {
    return existing;
  }
  // Do not infer live catalogue records from bundled fixtures when PostgreSQL is unavailable.
  return [];
}

export function resolveProductPreviewImage(product?: Product): string {
  if (!product) return '';
  const familyGallery = product.galleryImages?.find(
    (img) => img.scope === 'family' && Boolean(img.url),
  )?.url;
  if (familyGallery) return familyGallery;
  const anyGallery = product.galleryImages?.find((img) => Boolean(img.url))?.url;
  if (anyGallery) return anyGallery;
  if (product.image) return product.image;
  const direct = product.images?.find(Boolean);
  if (direct) return direct;
  for (const variant of product.variants || []) {
    const variantImage = variant.images?.find(Boolean);
    if (variantImage) return variantImage;
  }
  return '';
}

export function resolveCategoryFallbackArtwork(slug: string, name: string): string {
  const text = `${slug} ${name}`.toLowerCase();
  if (text.includes('excel-v2-1-') || text.includes('تسمه')) return '/images/belt-hero-cinematic.webp';
  if (text.includes('excel-v2-4-') || text.includes('پولی')) return '/images/pulley-premium-hero.svg';
  if (text.includes('excel-v2-9-') || text.includes('زنجیر') || text.includes('چرخ')) return '/images/pulley-hero-industrial.svg';
  if (text.includes('excel-v2-13-') || text.includes('بلبرینگ') || text.includes('یاتاقان')) return '/images/scan-industrial-generated.webp';
  if (text.includes('excel-v2-7-') || text.includes('اورینگ') || text.includes('پکینگ') || text.includes('لاستیکی')) return '/images/sanatpish-mobile-hero.webp';
  if (text.includes('excel-v2-2-') || text.includes('نقاله')) return '/images/belt-hero-cinematic.webp';
  return '/images/scan-industrial-generated.webp';
}

export interface EnrichedFamilyMenuAssignment extends FamilyMenuAssignment {
  groupId: string;
  submenu: string;
  leaf: string | null;
}

function inferGroupIdFromCategorySlug(categorySlug: string): string {
  const match = /^excel-v2-(\d+)-\d+$/.exec(categorySlug);
  if (match) {
    return `excel-v2-${match[1]}`;
  }
  for (const grp of APPROVED_MENU_GROUPS) {
    if (grp.categorySlugs.includes(categorySlug)) {
      return grp.id;
    }
  }
  return '';
}

function toEnrichedAssignment(base: FamilyMenuAssignment): EnrichedFamilyMenuAssignment {
  return {
    ...base,
    groupId: inferGroupIdFromCategorySlug(base.categorySlug),
    submenu: base.submenuName,
    leaf: base.leafName,
  };
}

export function getFamilyMenuAssignment(
  codeOrProduct: string | Product,
): EnrichedFamilyMenuAssignment | null {
  const code = typeof codeOrProduct === 'string' ? codeOrProduct : codeOrProduct.code;
  const explicit = CATALOG_FAMILY_MENU_ASSIGNMENTS[code];

  // The reviewed family map is the only public taxonomy source.
  // Legacy product.categorySlug/submenu values are not trusted as a fallback.
  return explicit ? toEnrichedAssignment(explicit) : null;
}

export type EnrichedApprovedMenuGroup = ApprovedMenuGroup & {
  familyCount: number;
  skuCount: number;
};

export interface EnrichedNavigationData {
  categories: EnhancedCategory[];
  groups: EnrichedApprovedMenuGroup[];
  groupByCategorySlug: Map<string, EnrichedApprovedMenuGroup>;
  totalFamilies: number;
  totalSkus: number;
}

export function resolveNavigationCategoriesAndGroups(): EnrichedNavigationData {
  const products = ensureCatalogFamiliesLoaded().filter((p) => p.active !== false);

  const byCategory = new Map<
    string,
    {
      familyCount: number;
      skuCount: number;
      firstImage: string;
      submenus: Map<
        string,
        { familyCount: number; skuCount: number; leaves: Map<string, { familyCount: number; skuCount: number }> }
      >;
    }
  >();

  let totalFamilies = 0;
  let totalSkus = 0;

  for (const product of products) {
    const skuCount = (product.variants || []).filter((v) => v.active !== false).length;
    totalFamilies += 1;
    totalSkus += skuCount;
    const assignment = getFamilyMenuAssignment(product);
    if (!assignment || !assignment.categorySlug) continue;
    const slug = assignment.categorySlug;

    if (!byCategory.has(slug)) {
      byCategory.set(slug, {
        familyCount: 0,
        skuCount: 0,
        firstImage: '',
        submenus: new Map(),
      });
    }
    const entry = byCategory.get(slug)!;
    entry.familyCount += 1;
    entry.skuCount += skuCount;
    if (!entry.firstImage) {
      const preview = resolveProductPreviewImage(product);
      if (preview) entry.firstImage = preview;
    }

    const subKey = normalizeText(assignment.submenuName);
    if (subKey) {
      if (!entry.submenus.has(subKey)) {
        entry.submenus.set(subKey, { familyCount: 0, skuCount: 0, leaves: new Map() });
      }
      const subEntry = entry.submenus.get(subKey)!;
      subEntry.familyCount += 1;
      subEntry.skuCount += skuCount;

      const leafKey = normalizeText(assignment.leafName);
      if (leafKey) {
        const prevLeaf = subEntry.leaves.get(leafKey) || { familyCount: 0, skuCount: 0 };
        subEntry.leaves.set(leafKey, {
          familyCount: prevLeaf.familyCount + 1,
          skuCount: prevLeaf.skuCount + skuCount,
        });
      }
    }
  }

  const enrichedGroups: EnrichedApprovedMenuGroup[] = APPROVED_MENU_GROUPS.map((group) => {
    let familyCount = 0;
    let skuCount = 0;
    for (const slug of group.categorySlugs) {
      const catStats = byCategory.get(slug);
      if (catStats) {
        familyCount += catStats.familyCount;
        skuCount += catStats.skuCount;
      }
    }
    return {
      ...group,
      familyCount,
      skuCount,
    };
  });

  const groupByCategorySlug = new Map<string, EnrichedApprovedMenuGroup>();
  for (const group of enrichedGroups) {
    for (const slug of group.categorySlugs) {
      groupByCategorySlug.set(slug, group);
    }
  }

  const categories: EnhancedCategory[] = APPROVED_MENU_CATEGORIES.map((baseCat) => {
    const stats = byCategory.get(baseCat.slug);
    const enrichedChildren: CategoryNode[] = (baseCat.children || []).map((subNode) => {
      const subStats = stats?.submenus.get(normalizeText(subNode.name));
      const leafChildren: CategoryNode[] | undefined = subNode.children?.map((leafNode) => {
        const leafStats = subStats?.leaves.get(normalizeText(leafNode.name));
        return {
          ...leafNode,
          familyCount: leafStats?.familyCount || 0,
          skuCount: leafStats?.skuCount || 0,
        };
      });
      return {
        ...subNode,
        familyCount: subStats?.familyCount || 0,
        skuCount: subStats?.skuCount || 0,
        children: leafChildren,
      };
    });

    return normalizeManagedCategory({
      ...baseCat,
      children: enrichedChildren,
      familyCount: stats?.familyCount || 0,
      count: stats?.familyCount || 0,
      skuCount: stats?.skuCount || 0,
      image: baseCat.image || stats?.firstImage || resolveCategoryFallbackArtwork(baseCat.slug, baseCat.name),
      active: true,
    });
  });

  return {
    categories,
    groups: enrichedGroups,
    groupByCategorySlug,
    totalFamilies,
    totalSkus,
  };
}

export interface ResolvedMenuCategoryFamily {
  code: string;
  name: string;
  brand: string;
  unit: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  subcategory: string;
  leaf: string | null;
  skuCount: number;
  image?: string;
  sampleSkus?: string[];
}

export interface ResolvedMenuCategorySubcategory {
  name: string;
  familyCount: number;
  skuCount: number;
  leaves: Array<{ name: string; familyCount: number; skuCount: number }>;
}

export interface ResolvedMenuCategoryPayload {
  success: boolean;
  category: EnhancedCategory;
  groupId?: string;
  groupTitle?: string;
  families: ResolvedMenuCategoryFamily[];
  subcategories: ResolvedMenuCategorySubcategory[];
}

export function resolveMenuCategoryPayload(slug: string): ResolvedMenuCategoryPayload | null {
  let cleanSlug = decodeURIComponent(slug || '').trim().replace(/^#/, '').replace(/^menu-group-/, '');
  const { categories, groups, groupByCategorySlug } = resolveNavigationCategoriesAndGroups();
  let category = categories.find((c) => c.slug === cleanSlug);
  if (!category) {
    const matchedGroup = groups.find((g) => g.id === cleanSlug || g.id === `excel-v2-${cleanSlug}`);
    if (matchedGroup && matchedGroup.categorySlugs.length > 0) {
      cleanSlug = matchedGroup.categorySlugs[0];
      category = categories.find((c) => c.slug === cleanSlug);
    }
  }
  if (!category) return null;

  const parentGroup = groupByCategorySlug.get(cleanSlug);
  const allProducts = ensureCatalogFamiliesLoaded().filter((p) => p.active !== false);

  const matchedFamilies: ResolvedMenuCategoryFamily[] = [];
  for (const product of allProducts) {
    const assignment = getFamilyMenuAssignment(product);
    if (!assignment || assignment.categorySlug !== cleanSlug) continue;

    const activeVariants = (product.variants || []).filter((v) => v.active !== false);
    // Empty submenu/leaf means "needs review"; never place it in the first menu node.
    const resolvedSubmenu = assignment.submenuName || '';
    const resolvedLeaf = assignment.leafName || '';

    matchedFamilies.push({
      code: product.code,
      name: product.name,
      brand: product.brand || 'FORZA',
      unit: product.unit || 'عدد',
      description: product.description || '',
      categorySlug: cleanSlug,
      categoryName: category.name,
      submenu: resolvedSubmenu,
      subcategory: resolvedLeaf,
      leaf: resolvedLeaf || null,
      skuCount: activeVariants.length,
      image: resolveProductPreviewImage(product),
      sampleSkus: activeVariants.slice(0, 4).map((v) => v.code),
    });
  }

  matchedFamilies.sort((a, b) => {
    const aHasImg = a.image ? 1 : 0;
    const bHasImg = b.image ? 1 : 0;
    if (bHasImg !== aHasImg) return bHasImg - aHasImg;
    if (b.skuCount !== a.skuCount) return b.skuCount - a.skuCount;
    return a.name.localeCompare(b.name, 'fa');
  });

  const subcategories: ResolvedMenuCategorySubcategory[] = (category.children || []).map(
    (node: CategoryNode) => {
      const nodeKey = normalizeText(node.name);
      const subFamilies = matchedFamilies.filter((f) => normalizeText(f.submenu) === nodeKey);
      const leaves = (node.children || []).map((leaf) => {
        const leafKey = normalizeText(leaf.name);
        const leafFamilies = subFamilies.filter((f) => normalizeText(f.subcategory) === leafKey);
        return {
          name: leaf.name,
          familyCount: leafFamilies.length,
          skuCount: leafFamilies.reduce((sum, f) => sum + (f.skuCount || 0), 0),
        };
      });
      return {
        name: node.name,
        familyCount: subFamilies.length,
        skuCount: subFamilies.reduce((sum, f) => sum + (f.skuCount || 0), 0),
        leaves,
      };
    },
  );

  return {
    success: true,
    category,
    groupId: parentGroup?.id,
    groupTitle: parentGroup?.title,
    families: matchedFamilies,
    subcategories,
  };
}
