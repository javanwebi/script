import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (file: string) => readFileSync(file, 'utf8');
const page = source('src/pages/AllCategoriesPage.tsx');
const styles = source('src/pages/all-categories-premium.css');
const routes = source('src/App.tsx');
const layout = source('src/components/layout/Layout.tsx');

test('all categories remains the canonical route and keeps existing category route registration', () => {
  assert.match(routes, /<Route path="\/categories" element={<AllCategoriesPage \/>} \/>/);
  assert.match(routes, /<Route path="\/category\/:slug" element={<CategoryPage \/>} \/>/);
  assert.match(page, /categoryHref\(category\.slug\)/);
  assert.match(layout, /"\\/categories"/);
});

test('category explorer reads approved navigation groups and category records from the database API', () => {
  assert.match(page, /fetch\('\/api\/catalog\/categories'/);
  assert.match(page, /fetch\('\/api\/catalog\/navigation-groups'/);
  assert.match(page, /group\.categorySlugs\.map\(slug => indexed\.get\(slug\)\)/);
  assert.match(page, /group\.active !== false/);
  assert.match(page, /category\.active !== false/);
  assert.match(page, /setSource\('database'\)/);
});

test('search is shareable and matches category names, descriptions, English labels and nested taxonomy', () => {
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /searchParams\.get\('q'\)/);
  assert.match(page, /next\.set\('q', value\)/);
  assert.match(page, /next\.delete\('q'\)/);
  assert.match(page, /flattenCategoryNodes\(category\.children \|\| \[\]\)/);
  assert.match(page, /normalizeSearch\(group\.title\)/);
});

test('fallback taxonomy is clearly labelled and never presents stale product or SKU counts as live', () => {
  assert.match(page, /source === 'fallback'/);
  assert.match(page, /آمار زنده در دسترس نیست/);
  assert.match(page, /آمار پس از اتصال به کاتالوگ/);
  assert.doesNotMatch(page, /USER_PRODUCTS|CATALOGUE_SKU_COUNT/);
  assert.match(page, /source === 'database' \? toPersianDigits\(catalogueGroups\.length\) : '—'/);
});

test('category cards reuse registered industrial assets and retain nested subcategory navigation', () => {
  assert.match(page, /category\.image\) return category\.image/);
  assert.match(page, /STORE_ASSETS\.categories\.belts/);
  assert.match(page, /STORE_ASSETS\.categories\.bearings/);
  assert.match(page, /STORE_ASSETS\.reverseEngineeringLab/);
  assert.match(page, /CategoryNavigation nodes=/);
  assert.match(page, /categoryHref\(category\.slug, node\.value \|\| node\.name\)/);
});

test('group anchors, search, visual identification and FORZA routes remain connected', () => {
  assert.match(page, /menu-group-\$\{section\.id\}/);
  assert.match(page, /to="\/identify-part"/);
  assert.match(page, /to="\/ai-consult"/);
  assert.match(page, /to="\/products"/);
});

test('category explorer has deliberate desktop, tablet, mobile, compact and reduced-motion styles', () => {
  assert.match(styles, /grid-template-columns: minmax\(0, 1\.08fr\) minmax\(360px, \.92fr\)/);
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /:focus-visible/);
});

test('all category page styles are scoped and do not modify global storefront components', () => {
  assert.match(page, /all-categories-premium\.css/);
  assert.match(styles, /\.all-categories-page/);
  assert.doesNotMatch(styles, /(^|\n)body\s*\{/);
  assert.doesNotMatch(styles, /(^|\n)\.store-product-card\s*\{/);
});
