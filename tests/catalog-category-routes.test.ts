import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../src/data/approvedMenuFallback';

const source = (file: string) => readFileSync(file, 'utf8');
const categories = source('src/data/categories.ts');
const allCategories = source('src/pages/AllCategoriesPage.tsx');
const megaMenu = source('src/components/catalog/ReferenceMegaMenu.tsx');
const mobileExplorer = source('src/components/catalog/MobileCategoryExplorer.tsx');
const header = source('src/components/layout/Header.tsx');
const categoryPage = source('src/pages/CategoryPage.tsx');
const admin = source('src/admin/modules/ProductsModule.tsx');
const api = source('server/catalogNavigationApi.ts');
const industry = source('src/pages/TileCeramicIndustryPage.tsx');
const searchPage = source('src/pages/SearchPage.tsx');
const productsPage = source('src/pages/ProductsPage.tsx');
const footer = source('src/components/layout/Footer.tsx');
const brandBanner = source('src/components/home/MainBrandsBanner.tsx');
const clubPage = source('src/pages/ClubPage.tsx');
const migration = source('supabase/migrations/20261116163011_canonical_category_routes.sql');

test('the approved menu exposes 34 unique category routes with no parent-route reuse', () => {
  assert.equal(APPROVED_MENU_CATEGORIES.length, 34);
  const categorySlugs = APPROVED_MENU_CATEGORIES.map(category => category.slug);
  const groupedSlugs = APPROVED_MENU_GROUPS.flatMap(group => group.categorySlugs);
  assert.equal(new Set(categorySlugs).size, 34);
  assert.equal(groupedSlugs.length, 34);
  assert.equal(new Set(groupedSlugs).size, 34);
  assert.deepEqual(new Set(groupedSlugs), new Set(categorySlugs));
  for (const category of APPROVED_MENU_CATEGORIES) {
    assert.match(category.slug, /^excel-v2-[0-9]+-[0-9]+$/);
    assert.equal(category.routeSlug, category.slug, category.name + ' must have its own canonical route');
  }
});

test('every approved category uses its own canonical route slug across storefront and admin', () => {
  assert.match(categories, /routeSlug\?: string/);
  assert.match(categories, /getCategoryRouteSlug/);
  assert.match(api, /routeSlug:row\.slug/);
  assert.match(allCategories, /getCategoryRouteSlug\(category\)/);
  assert.match(megaMenu, /getCategoryRouteSlug\(category\)/);
  assert.match(mobileExplorer, /getCategoryRouteSlug\(category\)/);
  assert.match(header, /getCategoryRouteSlug\(category\)/);
  assert.match(searchPage, /getCategoryRouteSlug\(cat\)/);
  assert.match(footer, /getCategoryRouteSlug\(category\)/);
  assert.match(admin, /routeSlug\?:string/);
  assert.match(admin, /editorApprovedCategory\?\.slug/);
});

test('retired category parents no longer render old category experiences', () => {
  assert.doesNotMatch(categoryPage, /BeltCategoryExperience/);
  assert.match(categoryPage, /LEGACY_CATEGORY_ROUTE_GROUPS/);
  assert.match(categoryPage, /'تسمه-و-انتقال-نیرو': 'excel-v2-1'/);
  assert.match(categoryPage, /'پولی-و-انتقال-نیرو': 'excel-v2-4'/);
  assert.match(categoryPage, /<Navigate to=\{destination\} replace \/>/);
});

test('industry category shortcuts open the new industrial-belts group instead of the retired parent page', () => {
  assert.match(industry, /link: '\/categories\?group=excel-v2-1'/);
  assert.match(productsPage, /categories\?\$\{destinationParams\.toString\(\)\}/);
  assert.match(productsPage, /group: 'excel-v2-1'/);
  assert.match(brandBanner, /categories\?group=excel-v2-1/);
  assert.doesNotMatch(brandBanner, /category\/(?:industrial-belts|power-transmission)/);
  assert.doesNotMatch(clubPage, /category\/industrial-belts/);
  assert.doesNotMatch(footer, /category\/industrial-belts/);
});

test('database migration assigns all approved categories their own route and safely retires empty legacy categories', () => {
  assert.match(migration, /jsonb_set/);
  assert.match(migration, /metadata->>'routeSlug'/);
  assert.match(migration, /SET is_active = false/);
  assert.match(migration, /catalog_family_menu_assignments/);
  assert.match(migration, /catalog_direct_skus/);
  assert.match(migration, /RAISE EXCEPTION/);
});
