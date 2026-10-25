import {durableStorage,databaseStorageEnabled} from "../services/durableStorage";
import { BELT_MENU, matchesBeltSelection } from "./beltNavigation";
import type { Category, Product } from '../types';
import { USER_PRODUCTS, USER_PRODUCTS_RAW, categorySlugFor } from './userProducts';

export interface CategoryNode { name: string; children?: CategoryNode[]; }
export interface EnhancedCategory extends Category {
  children: CategoryNode[]; image?: string; topModels?: string[]; brands?: string[]; featuredBadge?: string;
  /** Family count and exact SKU count are sourced from the catalog metadata in PostgreSQL. */
  familyCount?: number; skuCount?: number;
}
// Only columns A, B and C belong in navigation. Family names and SKU names never enter this tree.
const definitions: EnhancedCategory[] = [];
for (const family of USER_PRODUCTS_RAW) {
  let category = definitions.find(c => c.name === family.categoryName);
  if (!category) {
    category = { id: definitions.length + 1, name: family.categoryName, slug: categorySlugFor(family.categoryName),
      nameEn: '', icon: 'Package', description: '', children: [], subcategories: [], count: 0 };
    definitions.push(category);
  }
  const submenuName=family.submenu||family.subcategory;
  let submenu = category.children.find(n => n.name === submenuName);
  if (!submenu) { submenu = { name: submenuName, children: [] }; category.children.push(submenu); }
  if (!submenu.children!.some(n => n.name === family.subcategory)) submenu.children!.push({ name: family.subcategory });
}
export function flattenCategoryNodes(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap(node => [node, ...flattenCategoryNodes(node.children || [])]);
}
const legacyNames: Record<string, string> = {
  'belts-power-transmission': 'تسمه و انتقال نیرو', 'industrial-belts': 'تسمه و انتقال نیرو',
  'power-transmission': 'تسمه و انتقال نیرو', 'belts-timing': 'تسمه و انتقال نیرو', 'v-belts': 'تسمه و انتقال نیرو', 'timing-belts': 'تسمه و انتقال نیرو',
  'conveyors-industrial-chains': 'نوار و تسمه نقاله', 'chains-sprockets': 'زنجیر و چرخ‌زنجیر',
  'mechanical-motion-parts': 'قطعات مکانیکی', 'bearings-bushings': 'بلبرینگ و یاتاقان', 'bearings': 'بلبرینگ و یاتاقان',
  'wheels-rollers-guides': 'چرخ و رولر', 'rollers-wheels-gears': 'چرخ و رولر',
  'rubber-seals-dampers': 'آب‌بندی و قطعات لاستیکی', 'rubber-pu-suction': 'آب‌بندی و قطعات لاستیکی',
  'polymers-industrial-sheets': 'مواد و ورق صنعتی', 'polymer-teflon-parts': 'مواد و ورق صنعتی',
  'pumps-fluids-pneumatics': 'قطعات پمپ و سیالات', 'pumps-valves-mechanical': 'قطعات پمپ و سیالات', 'impellers-pumps': 'قطعات پمپ و سیالات',
  'production-ceramic-equipment': 'تجهیزات خطوط کاشی و سرامیک', 'ceramic-tiles': 'تجهیزات خطوط کاشی و سرامیک', 'kiln-roller-pins': 'تجهیزات خطوط کاشی و سرامیک', 'stacker-conveyor-parts': 'تجهیزات خطوط کاشی و سرامیک',
  'brushes-filtration-tools': 'برس و ابزار پرداخت', 'industrial-brushes': 'برس و ابزار پرداخت', 'glaze-brushes': 'برس و ابزار پرداخت',
  'industrial-fasteners-accessories': 'اتصالات و نگهدارنده', 'supports-brackets': 'اتصالات و نگهدارنده',
  'pulleys-idlers': 'پولی و انتقال نیرو', 'couplings-elastomers': 'انتقال قدرت مکانیکی',
  'profiles-rails-supports': 'ریل و تجهیزات هدایت', 'profiles-rails': 'ریل و تجهیزات هدایت',
  'hoses-channels': 'شیلنگ و اتصالات', 'vacuum-cleaners': 'تجهیزات وکیوم', 'seals-foam-refractory': 'آب‌بندی و درزگیری',
};
export const CATEGORY_ALIASES = Object.fromEntries(Object.entries(legacyNames).map(([slug, name]) => [slug, categorySlugFor(name)]));
export const resolveCategorySlug = (slug: string) => {
  const mapped = CATEGORY_ALIASES[slug] || slug;
  if (/^تسمه(?:\s|\u200c|-)+و(?:\s|\u200c|-)+انتقال(?:\s|\u200c|-)+(?:نیرو|قدرت)$/.test(mapped)) return 'تسمه-و-انتقال-نیرو';
  return mapped;
};
export function matchesCatalogCategory(product: Product, slug: string, selection = 'all'): boolean {
  if (product.categorySlug !== resolveCategorySlug(slug)) return false;
  if (selection === 'all') return true;
  const beltMatch = product.categoryName === 'تسمه و انتقال نیرو' ? matchesBeltSelection(product, selection) : undefined;
  return beltMatch ?? (product.submenu === selection || product.subcategory === selection);
}

const INITIAL_CATEGORIES: EnhancedCategory[] = definitions.map(category => {
  const products = USER_PRODUCTS.filter(p => p.categorySlug === category.slug);
  const familyCount = products.length;
  return {
    ...category,
    count: familyCount,
    familyCount,
    skuCount: products.reduce((sum, product) => sum + (product.variants?.length || 0), 0),
    description: category.children.map(n => n.name).join('، '),
    children: category.name === "تسمه و انتقال نیرو" ? BELT_MENU : category.children,
    subcategories: category.name === "تسمه و انتقال نیرو" ? BELT_MENU.map(n=>n.name) : category.children.map(n => n.name),
    image: products.find(p => p.images.length)?.images[0],
  };
});
// Browser arrays are populated only by /api/runtime after PostgreSQL hydration.
// Keep the Node-only fixture for legacy isolated tests; never paint this snapshot to users.
export const CATEGORIES: EnhancedCategory[] = typeof window === 'undefined' ? INITIAL_CATEGORIES : [];
export const PRIMARY_CATALOG_CATEGORIES = CATEGORIES;

export const CATEGORIES_STORAGE_KEY = 'atlas_admin_categories_v1';

/** Normalize the sparse PostgreSQL category projection to the full UI contract. */
export function normalizeManagedCategory(c: Record<string, any>): EnhancedCategory {
  const children: CategoryNode[] = Array.isArray(c.children) && c.children.length > 0
    ? c.children
    : (Array.isArray(c.subcategories)
      ? c.subcategories.map((s: string) => ({ name: s, children: [] }))
      : []);
  const familyCountValue = Number(c.familyCount ?? c.count ?? 0);
  const skuCountValue = Number(c.skuCount ?? c.itemCount ?? c.count ?? 0);
  const familyCount = Number.isFinite(familyCountValue) ? Math.max(0, familyCountValue) : 0;
  const skuCount = Number.isFinite(skuCountValue) ? Math.max(0, skuCountValue) : familyCount;
  const nameEn = typeof c.nameEn === 'string' ? c.nameEn : '';
  const description = typeof c.description === 'string' && c.description.trim()
    ? c.description
    : children.map(node => node.name).filter(Boolean).join('، ');
  const icon = typeof c.icon === 'string' && c.icon.trim() ? c.icon : 'Package';
  const image = typeof c.image === 'string' && c.image.trim() ? c.image : undefined;

  return {
    ...c,
    nameEn,
    description,
    icon,
    image,
    count: familyCount,
    familyCount,
    skuCount,
    children,
  };
}

export function getManagedCategories(): EnhancedCategory[] {
  if (typeof window === 'undefined') return CATEGORIES;
  // A client with no hydrated database must not show stale checked-in catalogue menus.
  if (!databaseStorageEnabled()) return [];
  try {
    const raw = durableStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && (databaseStorageEnabled() || parsed.length > 0)) {
        return parsed.map((c: Record<string, any>) => normalizeManagedCategory(c));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export const findCatalogCategory = (slug: string) =>
  getManagedCategories().find(category => resolveCategorySlug(category.slug) === resolveCategorySlug(slug));
