import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/BeltCategoryExperience.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/BeltCategoryExperience.css', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/pages/CategoryPage.tsx', import.meta.url), 'utf8');
const directSkus = readFileSync(new URL('../src/components/catalog/DirectSkuProducts.tsx', import.meta.url), 'utf8');

test('direct SKU records are rendered in the same belt collection as family cards', () => {
  assert.match(route, /return <BeltCategoryExperience \/>/);
  assert.doesNotMatch(route, /DirectSkuProducts categorySlug=\{canonicalBeltSlug\}/);
  assert.match(page, /const directSkuRecords = useDirectSkus\(BELT_SLUG, 'excel-v2-1-'\)/);
  assert.match(page, /const directSkuProducts = useMemo/);
  assert.match(page, /const collectionProducts = useMemo/);
  assert.match(page, /detailPath=\{directSkuCodes\.has\(p\.code\)/);
  assert.match(directSkus, /\/api\/catalog\/direct-skus/);
  assert.match(directSkus, /DirectSkuProductCard/);
  assert.doesNotMatch(directSkus, /قطعات کم‌تعداد بدون الزام به ساخت خانواده/);
});

test('the belt page defaults to the complete live catalogue and retains real catalogue filters', () => {
  assert.match(page, /searchParams\.get\('sub'\) \|\| 'all'/);
  assert.match(page, /getProductsByCategory\(BELT_SLUG, 12000\)/);
  assert.match(page, /subscribeCatalogChanges/);
  assert.match(page, /matchesCatalogCategory/);
  assert.match(page, /matchesProductSearch/);
  assert.match(page, /deriveProfileOptions\(collectionProducts\)/);
  assert.match(page, /const isVbelt = selectedFamily === 'تسمه V-BELT'/);
  assert.doesNotMatch(page, /isClassic/);
  assert.match(page, /filters\.brands/);
  assert.match(page, /productHasDisplayBrand\(product, brand\)/);
  assert.match(page, /filters\.minimumLength/);
  assert.match(page, /filters\.maximumLength/);
  assert.match(page, /filters\.minimumPrice/);
  assert.match(page, /filters\.maximumPrice/);
  assert.match(page, /filters\.inStock/);
  assert.match(page, /filters\.inStock && !\(product\.stockKnown && product\.stock > 0\)/);
  assert.match(page, /filters\.quoteOnly/);
  assert.match(page, /sortBy === 'code'/);
  assert.match(page, /sortBy === 'price-low'/);
  assert.match(page, /sortBy === 'price-high'/);
  assert.match(page, /const pageSize = 24/);
  assert.match(page, /<MemberAccess code=\{?product\.code/);
});

test('the reference composition adds a real featured product, list rows and a working comparison flow', () => {
  assert.match(page, /function FeaturedProductCard/);
  assert.match(page, /featuredProduct && <FeaturedProductCard/);
  assert.match(page, /className="bce-products-list"/);
  assert.match(page, /className="bce-compare-dock"/);
  assert.match(page, /setCompareOpen\(true\)/);
  assert.match(page, /current\.length < 4/);
  assert.match(page, /compareProducts\.length < 2/);
  assert.match(page, /className="bce-compare-table"/);
  assert.match(page, /comparisonSpecKeys\.map/);
  assert.match(page, /aria-modal="true"/);
});

test('the redesign retains the guide, industry links, FORZA entry points and mobile filter sheet', () => {
  for (const marker of [
    'bce-selection-guide',
    'bce-industry-section',
    'bce-help-cards',
    'bce-bottom-line',
    'bce-sheet-backdrop',
    '/identify-part',
    '/ai-consult'
  ]) {
    assert.ok(page.includes(marker), 'missing retained page content or route: ' + marker);
  }
  assert.match(page, /applySheet/);
  assert.match(page, /FilterFields value=\{draft\}/);
});

test('the approved cream industrial visual system has explicit desktop, mobile and reduced-motion rules', () => {
  assert.match(css, /--bce-orange: #E56B1E/);
  assert.match(css, /--bce-bg: #fbf6ef/);
  assert.match(css, /bce-hero-picture/);
  assert.match(css, /height: clamp\(164px, 17\.5vw, 205px\) !important/);
  assert.match(css, /direction: rtl/);
  assert.match(css, /clip-path: polygon\(0 0, 100% 0, 84% 100%, 0 100%\)/);
  assert.match(css, /grid-template-columns: minmax\(210px, 25%\) minmax\(0, 1fr\) minmax\(195px, 23%\)/);
  assert.match(css, /\.bce-catalog \{[\s\S]*?direction: rtl;[\s\S]*?grid-template-columns: minmax\(210px, 25%\) minmax\(0, 1fr\) minmax\(195px, 23%\)/);
  assert.match(css, /DOM order is filters, results, featured; RTL grid flow places them right, center, left/);
  assert.match(css, /grid-template-columns: minmax\(190px, 25%\) minmax\(0, 1fr\)/);
  for (const width of ['860px', '640px', '390px', '360px']) {
    assert.ok(css.includes('max-width: ' + width), 'missing responsive breakpoint ' + width);
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('belt product cards do not invent technical dimensions, material or stock claims', () => {
  assert.match(page, /const cardSpecs = \(product\.technicalSpecs \|\| \[\]\)/);
  assert.doesNotMatch(page, /'۱۵۰ استاندارد'|'۳۰ میلی‌متر'/);
  assert.match(page, /استعلام موجودی/);
});

test('direct SKU cards do not borrow inferred product imagery or placeholder manufacturer names', () => {
  assert.match(page, /disableFallbackImage=\{directSkuCodes\.has\(p\.code\)\}/);
  assert.match(page, /disableFallback=\{disableFallbackImage\}/);
  assert.match(page, /تصویر تأییدشده ثبت نشده/);
  assert.doesNotMatch(page, /product\.brand \|\| 'قطعات صنعتی'/);
});

test('belt subcategory navigation counts include unique direct SKU records as well as family records', () => {
  assert.match(page, /const familyCodeSet = useMemo/);
  assert.match(page, /filter\(product => !familyCodeSet\.has/);
  assert.match(page, /const displayBrands = useMemo\([\s\S]*?brands\.filter/);
  assert.doesNotMatch(page, /const standard = \['Megadyne'/);
  assert.match(page, /products\.filter\(product => productHasDisplayBrand\(product, brand\)\)/);
  assert.match(page, /const directSkuCount = directSkuRecords\.filter/);
  assert.match(page, /counts\.set\(option\.id, matchingFamilies\.length \+ directSkuCount\)/);
});
