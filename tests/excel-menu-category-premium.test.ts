import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (file: string) => readFileSync(file, 'utf8');
const page = source('src/pages/ExcelMenuCategoryPage.tsx');
const styles = source('src/pages/excel-menu-category-premium.css');
const routes = source('src/pages/CategoryPage.tsx');
const api = source('server/catalogNavigationApi.ts');

test('approved Excel taxonomy slugs continue to use the dedicated database-backed category route', () => {
  assert.ok(routes.includes("if (/^excel-v2-[0-9]+-[0-9]+$/.test(slug || ''))"));
  assert.match(routes, /return <ExcelMenuCategoryPage \/>/);
  assert.match(page, /fetch\('\/api\/catalog\/menu-category\/' \+ encodeURIComponent\(slug\)/);
});

test('category detail API returns only the approved database taxonomy and active assigned families', () => {
  assert.match(api, /app\.get\('\/api\/catalog\/menu-category\/:slug'/);
  assert.match(api, /metadata->>'source'='industrial_megamenu_hierarchy_v2'/);
  assert.match(api, /catalog_family_menu_assignments/);
  assert.match(api, /f\.is_active=true and f\.is_deleted=false/);
  assert.match(api, /coalesce\(f\.item_count,0\) as "skuCount"/);
  assert.match(api, /Cache-Control','no-store'/);
  assert.doesNotMatch(api.slice(api.indexOf("app.get('/api/catalog/menu-category/:slug'"), api.indexOf('// Admin-only taxonomy review')), /price_snapshot|retail_price|wholesale_price/);
});

test('category detail reads real family records and never falls back to repository fixtures', () => {
  assert.match(page, /body\.success/);
  assert.match(page, /Array\.isArray\(body\.families\)/);
  assert.match(page, /setData\(body\)/);
  assert.doesNotMatch(page, /APPROVED_MENU_CATEGORIES|USER_PRODUCTS_RAW|INITIAL_CATEGORIES/);
  assert.match(page, /status === 'error'/);
  assert.match(page, /تلاش مجدد/);
});

test('subcategory, search, brand, image and verified-stock filters are shareable in the URL', () => {
  assert.match(page, /searchParams\.get\('sub'\)/);
  assert.match(page, /searchParams\.get\('q'\)/);
  assert.match(page, /searchParams\.getAll\('brand'\)/);
  assert.match(page, /searchParams\.get\('stock'\) === '1'/);
  assert.match(page, /searchParams\.get\('image'\) === '1'/);
  assert.match(page, /next\.delete\('page'\)/);
  assert.match(page, /product\?\.stockKnown === true && product\.stock > 0 && !product\.inquiryOnly/);
  assert.match(page, /imageOnly && !hasCatalogImage\(product\)/);
  assert.match(page, /product\?\.galleryImages/);
  assert.match(page, /variant\.images/);
});

test('profile and dimension filters use real family and SKU specs and remain shareable', () => {
  assert.match(page, /searchParams\.get\('spec'\)/);
  assert.match(page, /searchParams\.get\('specValue'\)/);
  assert.match(page, /const matchesTechnicalFilter = \(product: Product \| undefined, specKey: string, specValue: string\)/);
  assert.match(page, /const normalizeSpecValue = \(value: string\)/);
  assert.match(page, /replace\(\/\[×\*\]\/g, 'x'\)/);
  assert.match(page, /variant\.technicalSpecs \|\| \[\]/);
  assert.match(page, /const availableSpecKeys = useMemo/);
  assert.match(page, /پروفیل\|قطر\|عرض\|طول\|گام\|ضخامت\|سایز\|ابعاد/);
  assert.match(page, /updateParam\('spec', event\.target\.value\)/);
  assert.match(page, /updateParam\('specValue', event\.target\.value\)/);
  assert.match(page, /aria-label="مقدار پروفیل یا ابعاد"/);
  assert.match(page, /Number\(Boolean\(specKey \|\| specValue\)\)/);
  assert.match(page, /'spec', 'specValue'/);
  assert.match(styles, /\.excel-category-spec-filter select/);
});

test('category search includes actual family codes, product technical specs and variant codes', () => {
  assert.match(page, /family\.code/);
  assert.match(page, /product\?\.technicalSpecs/);
  assert.match(page, /variant\.code/);
  assert.match(page, /variant\.technicalSpecs/);
});

test('family product cards preserve a usable image from the family gallery or SKU gallery', () => {
  assert.match(page, /const hasCatalogImage = \(product\?: Product\)/);
  assert.match(page, /product\.galleryImages\?\.some\(image => Boolean\(image\.url\)\)/);
  assert.match(page, /product\.image \|\|/);
  assert.match(page, /variant\.images\?\.some\(Boolean\)/);
  assert.match(page, /const productPreviewImage = \(product\?: Product\)/);
  assert.match(page, /const previewImage = productPreviewImage\(product\)/);
  assert.match(page, /images: product\.images\?\.some\(Boolean\) \? product\.images : previewImage \? \[previewImage\] : \[\]/);
  assert.match(page, /<ProductCard product=\{cardProduct\}/);
});

test('direct SKU catalogue, family product cards and inquiry-safe detail links remain connected', () => {
  assert.match(page, /DirectSkuProductCard/);
  assert.match(page, /const filteredDirectSkus = useMemo/);
  assert.match(page, /filteredCollectionItems/);
  assert.match(page, /const cardProduct = product \?/);
  assert.match(page, /<ProductCard product=\{cardProduct\}/);
  assert.match(page, /'\/product\/' \+ encodeURIComponent\(family\.code\)/);
  assert.match(page, /to="\/identify-part"/);
  assert.match(page, /to="\/ai-consult"/);
});

test('technical comparison is limited to four families and uses registered family specs', () => {
  assert.match(page, /compareCodes\.length >= 4/);
  assert.match(page, /comparisonSpecs/);
  assert.match(page, /compareFamilies\.flatMap\(family => \{/);
  assert.match(page, /variant\.technicalSpecs \|\| \[\]/);
  assert.match(page, /\.filter\(spec => spec\.key === specKey\)/);
  assert.match(page, /const product = products\.get\(family\.code\)/);
  assert.match(page, /role="dialog" aria-modal="true"/);
  assert.match(page, /قیمت و اطلاعات موجودی بر اساس سطح دسترسی حساب مشتری نمایش داده می‌شود/);
});

test('mobile filter and comparison dialogs support Escape, focus containment and body scroll locking', () => {
  assert.match(page, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(page, /event\.key === 'Escape'/);
  assert.match(page, /event\.key !== 'Tab'/);
  assert.match(page, /last\.focus\(\)/);
  assert.match(page, /previousFocus\?\.focus\(\)/);
  assert.match(page, /aria-modal="true"/);
});

test('category detail styling covers desktop, tablet, mobile, narrow phones and reduced motion', () => {
  assert.match(styles, /grid-template-columns: 280px minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.excel-subcard/);
  assert.match(styles, /\.excel-view-switcher/);
  assert.match(styles, /\.excel-page-num\.is-active/);
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test('category detail CSS is isolated from shared storefront and portal components', () => {
  assert.match(page, /excel-menu-category-premium\.css/);
  assert.match(styles, /\.excel-category-page/);
  assert.doesNotMatch(styles, /(^|\n)body\s*\{/);
  assert.doesNotMatch(styles, /(^|\n)\.store-product-card\s*\{/);
});

test('V-Belt category includes data-driven profile matrix, structure and top-width filters, and brand resolution', () => {
  assert.match(page, /VBELT_PROFILE_GROUPS/);
  assert.match(page, /VBELT_TOP_WIDTH_OPTIONS/);
  assert.match(page, /VBELT_STRUCTURE_OPTIONS/);
  assert.match(page, /const matchesExactBeltProfile =/);
  assert.match(page, /const matchesBeltStructure =/);
  assert.match(page, /const matchesBeltTopWidth =/);
  assert.match(page, /resolveDisplayBrand/);
  assert.match(page, /className="excel-vbelt-matrix"/);
  assert.match(styles, /\.excel-vbelt-matrix/);
  assert.match(styles, /\.excel-vbelt-groups-grid/);
});


test('family cards and direct SKU cards share one filtered, sorted and paginated subcategory collection', () => {
  assert.match(page, /const directSkus = useDirectSkus\(\)/);
  assert.match(page, /const filteredCollectionItems = useMemo/);
  assert.match(page, /const pageItems = filteredCollectionItems\.slice/);
  assert.match(page, /pageItems\.map\(entry =>/);
  assert.match(page, /DirectSkuProductCard/);
  assert.doesNotMatch(page, /DirectSkuProducts categorySlug=/);
});

test('brand facets use real manufacturer brands from families, active SKU variants and direct SKU records', () => {
  assert.match(page, /const familyBrandLists = useMemo/);
  assert.match(page, /getProductDisplayBrands\(product\)/);
  assert.match(page, /directSkusInCategory\.forEach/);
  assert.match(page, /productHasDisplayBrand\(product, brand\)/);
  assert.doesNotMatch(page, /resolved === 'صنعت پیش'/);
  assert.doesNotMatch(page, /resolved === 'وارداتی صنعتی'/);
});

test('the all-products page can read the live approved family-to-subcategory mapping without exposing commerce fields', () => {
  assert.match(api, /app\.get\('\/api\/catalog\/menu-family-index'/);
  const indexRoute = api.slice(api.indexOf("app.get('/api/catalog/menu-family-index'"), api.indexOf("// Read-only four-level menu taxonomy"));
  assert.match(indexRoute, /catalog_family_menu_assignments/);
  assert.match(indexRoute, /family_code as "familyCode"/);
  assert.match(indexRoute, /Cache-Control','no-store'/);
  assert.doesNotMatch(indexRoute, /price_snapshot|retail_price|wholesale_price|stock_reserved/);
});
