import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import express from 'express';
import { registerCategorySeoRoutes } from '../server/categorySeoRoutes';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../src/data/approvedMenuFallback';
import { APPROVED_CATEGORY_SEO_ROUTES, getCategorySeoMetadata, getCategorySeoRouteSlug, getInternalCategorySlugFromRouteSlug } from '../src/data/categorySeoRoutes';

const source = (file: string) => readFileSync(file, 'utf8');
const categories = source('src/data/categories.ts');
const allCategories = source('src/pages/AllCategoriesPage.tsx');
const megaMenu = source('src/components/catalog/ReferenceMegaMenu.tsx');
const mobileExplorer = source('src/components/catalog/MobileCategoryExplorer.tsx');
const header = source('src/components/layout/Header.tsx');
const categoryPage = source('src/pages/CategoryPage.tsx');
const excelPage = source('src/pages/ExcelMenuCategoryPage.tsx');
const categoryNavigation = source('src/components/catalog/CategoryNavigation.tsx');
const allCategoriesPage = source('src/pages/AllCategoriesPage.tsx');
const admin = source('src/admin/modules/ProductsModule.tsx');
const api = source('server/catalogNavigationApi.ts');
const industry = source('src/pages/TileCeramicIndustryPage.tsx');
const searchPage = source('src/pages/SearchPage.tsx');
const productsPage = source('src/pages/ProductsPage.tsx');
const footer = source('src/components/layout/Footer.tsx');
const productDetail = source('src/pages/ProductDetailPage.tsx');
const directSkuDetail = source('src/pages/DirectSkuDetailPage.tsx');
const popularProducts = source('src/components/home/PopularProductsSection.tsx');
const brandBanner = source('src/components/home/MainBrandsBanner.tsx');
const discoveryPages = source('src/pages/DiscoveryPages.tsx');
const clubPage = source('src/pages/ClubPage.tsx');
const migration = source('supabase/migrations/20261116163011_canonical_category_routes.sql');
const routeMap = source('src/data/categorySeoRoutes.ts');
const serverSeo = source('server/categorySeoRoutes.ts');
const serverEntry = source('server.ts');

test('the approved menu exposes 34 unique category routes with no parent-route reuse', () => {
  assert.equal(APPROVED_MENU_CATEGORIES.length, 34);
  const categorySlugs = APPROVED_MENU_CATEGORIES.map(category => category.slug);
  const groupedSlugs = APPROVED_MENU_GROUPS.flatMap(group => group.categorySlugs);
  assert.equal(new Set(categorySlugs).size, 34);
  assert.equal(groupedSlugs.length, 34);
  assert.equal(new Set(groupedSlugs).size, 34);
  assert.deepEqual(new Set(groupedSlugs), new Set(categorySlugs));
  assert.equal(APPROVED_CATEGORY_SEO_ROUTES.length, 34);
  assert.equal(new Set(APPROVED_CATEGORY_SEO_ROUTES.map(route => route.routeSlug)).size, 34);
  assert.equal(new Set(APPROVED_CATEGORY_SEO_ROUTES.map(route => route.description)).size, 34);
  for (const route of APPROVED_CATEGORY_SEO_ROUTES) {
    assert.ok(route.description.length >= 100 && route.description.length <= 155);
    assert.equal(getCategorySeoMetadata(route.categorySlug)?.description, route.description);
  }
  for (const route of APPROVED_CATEGORY_SEO_ROUTES) {
    assert.ok(route.routeSlug.includes('-'));
    assert.ok(!/[\s_]/.test(route.routeSlug));
    assert.ok(!route.routeSlug.startsWith('excel-v2-'));
  }
  for (const category of APPROVED_MENU_CATEGORIES) {
    assert.match(category.slug, /^excel-v2-[0-9]+-[0-9]+$/);
    assert.ok(category.routeSlug && !category.routeSlug.startsWith('excel-v2-'));
    assert.equal(category.routeSlug, getCategorySeoRouteSlug(category.slug), category.name + ' must have its own Persian SEO route');
    assert.equal(getInternalCategorySlugFromRouteSlug(category.routeSlug), category.slug);
  }
});

test('every approved category uses its own canonical route slug across storefront and admin', () => {
  assert.match(categories, /routeSlug\?: string/);
  assert.match(categories, /getCategoryRouteSlug/);
  assert.match(categories, /getCategoryRoutePath/);
  assert.match(categoryNavigation, /getCategoryRoutePath\(categorySlug\)/);
  assert.match(allCategoriesPage, /getCategoryRoutePath\(category\.slug\)/);
  assert.match(categories, /getInternalCategorySlugFromRouteSlug/);
  assert.match(api, /routeSlug:typeof metadata\.routeSlug==='string'\?metadata\.routeSlug:row\.slug/);
  assert.match(allCategories, /getCategoryRouteSlug\(category\)/);
  assert.match(megaMenu, /getCategoryRouteSlug\(category\)/);
  assert.match(mobileExplorer, /getCategoryRouteSlug\(category\)/);
  assert.match(searchPage, /getCategoryRouteSlug\(cat\)/);
  assert.match(header, /getCategoryRoutePath\(category\.slug\)/);
  assert.match(megaMenu, /getCategoryRoutePath\(category\.slug\)/);
  assert.match(searchPage, /getCategoryRouteSlug\(cat\)/);
  assert.match(footer, /getCategoryRouteSlug\(category\)/);
  assert.match(productDetail, /getCategoryRoutePath\(product\.categorySlug\)/);
  assert.match(directSkuDetail, /getCategoryRoutePath\(item\.categorySlug\)/);
  assert.match(popularProducts, /getCategoryRoutePath\(product\.categorySlug\)/);
  assert.match(admin, /const legacyTargetSlug=editorApprovedCategory\?\.slug/);
  assert.match(admin, /stable database ID/);
  assert.doesNotMatch(admin, /editorApprovedCategory.{0,120}routeSlug/);
});

test('retired category parents no longer render old category experiences', () => {
  assert.doesNotMatch(categoryPage, /BeltCategoryExperience/);
  assert.match(categoryPage, /LEGACY_CATEGORY_ROUTE_GROUPS/);
  assert.match(categoryPage, /getInternalCategorySlugFromRouteSlug\(routeSlug\)/);
  assert.match(categoryPage, /getCategorySeoRouteSlug\(internalCategorySlug\)/);
  assert.match(categoryPage, /search: location\.search, hash: location\.hash/);
  assert.match(excelPage, /getCategorySeoMetadata\(slug\)/);
  assert.match(categoryPage, /LEGACY_CATEGORY_ROUTE_GROUPS/);
  assert.match(serverSeo, /res\.redirect\(301/);
  assert.match(serverEntry, /registerCategorySeoRoutes\(app\)/);
  assert.match(routeMap, /'تسمه-و-انتقال-نیرو': 'excel-v2-1'/);
  assert.match(routeMap, /'پولی-و-انتقال-نیرو': 'excel-v2-4'/);
  assert.match(routeMap, /'تجهیزات-وکیوم': null/);
  assert.match(routeMap, /'production-fittings': null/);
  assert.match(routeMap, /'timing-belts': 'excel-v2-1'/);
  assert.match(routeMap, /'conveyors-industrial-chains': 'excel-v2-2'/);
  assert.match(routeMap, /'production-ceramic-equipment': 'excel-v2-10'/);
  assert.match(categoryPage, /<Navigate to=\{destination\} replace \/>/);
});

test('industry category shortcuts open the new industrial-belts group instead of the retired parent page', () => {
  assert.match(industry, /link: '\/categories\?group=excel-v2-1'/);
  assert.match(industry, /link: '\/categories\?group=excel-v2-3'/);
  assert.match(industry, /link: '\/categories\?group=excel-v2-7'/);
  assert.match(brandBanner, /getCategoryRoutePath\('excel-v2-4-1'\)/);
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
  assert.match(migration, /تسمه-تایمینگ-صنعتی/);
  assert.match(migration, /نوار-نقاله-صنعتی/);
  assert.match(migration, /count\(DISTINCT metadata->>'routeSlug'\)/i);
  assert.match(migration, /catalog_categories_active_seo_route_slug_unique/);
  assert.match(migration, /to_regclass\('public\.catalog_family_menu_assignments'\)/);
  assert.match(migration, /EXECUTE 'CREATE UNIQUE INDEX/);
  for (const route of APPROVED_CATEGORY_SEO_ROUTES) {
    assert.ok(migration.includes(`('${route.categorySlug}', '${route.routeSlug}')`), route.categorySlug + ' SQL route mapping must match the shared route registry');
  }
  assert.match(serverSeo, /APPROVED_CATEGORY_SEO_ROUTES\.map/);
  assert.match(serverSeo, /app\.get\('\/sitemap\.xml'/);
  assert.match(serverSeo, /app\.get\('\/robots\.txt'/);
  assert.match(discoveryPages, /SANAT_PISH_CANONICAL_ORIGIN/);
  assert.match(discoveryPages, /canonical\.href = SANAT_PISH_CANONICAL_ORIGIN/);
  assert.match(discoveryPages, /article\?\.summary/);
  assert.match(migration, /SET is_active = false/);
  assert.match(migration, /catalog_family_menu_assignments/);
  assert.match(migration, /catalog_direct_skus/);
  assert.match(migration, /RAISE EXCEPTION/);
});

test('production SEO routes issue permanent redirects and expose all approved URLs in sitemap and robots', async () => {
  const app = express();
  registerCategorySeoRoutes(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const oldId = await fetch(origin + '/category/excel-v2-1-1?sub=پلی-یورتان', { redirect: 'manual' });
    assert.equal(oldId.status, 301);
    assert.equal(oldId.headers.get('location'), '/category/' + encodeURIComponent('تسمه-تایمینگ-صنعتی') + '?sub=' + encodeURIComponent('پلی-یورتان'));

    const oldParent = await fetch(origin + '/category/' + encodeURIComponent('تسمه-و-انتقال-نیرو'), { redirect: 'manual' });
    assert.equal(oldParent.status, 301);
    assert.equal(oldParent.headers.get('location'), '/categories?group=excel-v2-1');

    const oldEnglishAlias = await fetch(origin + '/category/industrial-belts', { redirect: 'manual' });
    assert.equal(oldEnglishAlias.status, 301);
    assert.equal(oldEnglishAlias.headers.get('location'), '/categories?group=excel-v2-1');

    const oldParentId = await fetch(origin + '/category/excel-v2-1', { redirect: 'manual' });
    assert.equal(oldParentId.status, 301);
    assert.equal(oldParentId.headers.get('location'), '/categories?group=excel-v2-1');

    const sitemap = await fetch(origin + '/sitemap.xml');
    assert.equal(sitemap.status, 200);
    const xml = await sitemap.text();
    assert.equal((xml.match(/<url>/g) || []).length, 54);
    assert.ok(xml.includes(encodeURIComponent('تسمه-تایمینگ-صنعتی')));
    assert.ok(xml.includes(encodeURIComponent('اسکاج-صنعتی')));
    assert.ok(xml.includes('/industries/ceramic'));
    assert.ok(xml.includes('/knowledge/identify-belt'));
    assert.ok(xml.includes('/brands'));
    assert.ok(!xml.includes('/category/excel-v2-'), 'sitemap must not publish internal category IDs');

    const robots = await fetch(origin + '/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /Sitemap: https:\/\/sanatpish\.com\/sitemap\.xml/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
