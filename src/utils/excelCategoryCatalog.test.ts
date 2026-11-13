import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCategoryFacetProfile,
  buildPaginationWindow,
  buildSubcategoryStripNodes,
  extractNumericDimensions,
  matchesDimensionRange,
  matchesDynamicFacetToken,
  parseNumericInput,
  resolveExcelCategoryArtwork,
  resolveSubcategoryThumb,
  type MenuFamilySummary,
} from './excelCategoryCatalog';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../data/approvedMenuFallback';
import { STORE_ASSETS } from '../assets/images';
import type { Product } from '../types';

const makeProduct = (
  code: string,
  name: string,
  specs: Array<{ key: string; value: string }>,
  variantSizes: string[] = [],
): Product => ({
  code,
  name,
  brand: 'مگادین',
  categorySlug: 'تسمه-و-انتقال-نیرو',
  categoryName: 'تسمه و انتقال نیرو',
  submenu: 'تسمه تایمینگ',
  subcategory: 'تسمه تایمینگ',
  technicalSpecs: specs,
  variants: variantSizes.map((size, idx) => ({
    code: `${code}-${idx + 1}`,
    name: `${name} ${size}`,
    size,
    price: 0,
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    images: [],
    active: true,
  })),
  prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
  stock: 0,
  stockKnown: false,
  inquiryOnly: true,
  images: [],
  tags: [],
  unit: 'عدد',
  description: '',
});

test('parseNumericInput normalizes Persian and Arabic digits safely', () => {
  assert.equal(parseNumericInput('۱۲۵۰'), 1250);
  assert.equal(parseNumericInput('12.7 mm'), 12.7);
  assert.equal(parseNumericInput('٠٨٥'), 85);
  assert.equal(parseNumericInput(''), null);
  assert.equal(parseNumericInput('abc'), null);
});

test('extractNumericDimensions and matchesDimensionRange filter accurately on real specs', () => {
  const family: MenuFamilySummary = {
    code: 'FAM-1',
    name: 'تسمه وی‌بلت کلاسیک SPA 1250',
    brand: 'مگادین',
    submenu: 'تسمه اسپشیال',
    leaf: null,
    skuCount: 1,
  };
  const prod = makeProduct('FAM-1', family.name, [
    { key: 'پروفیل', value: 'SPA' },
    { key: 'طول درج‌شده در کد', value: '1250 میلی‌متر' },
    { key: 'عرض اسمی بالای پروفیل (مرجع)', value: '12.7 میلی‌متر' },
  ]);

  const dims = extractNumericDimensions(family, prod);
  assert.ok(dims.primaryValues.includes(1250));
  assert.ok(dims.secondaryValues.includes(12.7));

  assert.equal(matchesDimensionRange(dims, '1000', '1500', '10', '15'), true);
  assert.equal(matchesDimensionRange(dims, '1300', '1600', '', ''), false);
  assert.equal(matchesDimensionRange(dims, '', '', '14', '20'), false);
});

test('buildCategoryFacetProfile adapts primary facet options per category data', () => {
  const timingFamilies: MenuFamilySummary[] = [
    { code: 'FAM-8M', name: 'تسمه 8M مگادین', brand: 'مگادین', submenu: 'انواع گام', leaf: null, skuCount: 3 },
    { code: 'FAM-T10', name: 'تسمه T10 پلی‌یورتان', brand: 'FORZA', submenu: 'سیم‌دار فابریک', leaf: null, skuCount: 2 },
  ];
  const products = new Map<string, Product>([
    ['FAM-8M', makeProduct('FAM-8M', 'تسمه 8M مگادین', [{ key: 'پروفیل', value: '8M' }])],
    ['FAM-T10', makeProduct('FAM-T10', 'تسمه T10 پلی‌یورتان', [{ key: 'پروفیل', value: 'T10' }])],
  ]);

  const timingProfile = buildCategoryFacetProfile('excel-v2-1-1', 'تسمه تایمینگ', timingFamilies, products);
  assert.equal(timingProfile.primaryFacetTitle, 'گام و پروفیل تایمینگ');
  assert.ok(timingProfile.primaryFacetOptions.some(opt => opt.value === '8M' && opt.count === 1));
  assert.ok(timingProfile.primaryFacetOptions.some(opt => opt.value === 'T10' && opt.count === 1));

  assert.equal(matchesDynamicFacetToken(timingFamilies[0], products.get('FAM-8M'), '8M'), true);
  assert.equal(matchesDynamicFacetToken(timingFamilies[0], products.get('FAM-8M'), 'T10'), false);

  const bearingFamilies: MenuFamilySummary[] = [
    { code: 'FAM-B1', name: 'بلبرینگ 6205 2RS', brand: 'SKF', submenu: 'انواع بلبرینگ', leaf: null, skuCount: 1 },
  ];
  const bearingProducts = new Map<string, Product>([
    ['FAM-B1', makeProduct('FAM-B1', 'بلبرینگ 6205 2RS', [{ key: 'مدل پایه', value: '6205' }, { key: 'پسوند درج‌شده', value: '2RS' }])],
  ]);
  const bearingProfile = buildCategoryFacetProfile('excel-v2-13-1', 'بلبرینگ صنعتی', bearingFamilies, bearingProducts);
  assert.equal(bearingProfile.primaryFacetTitle, 'سری و آب‌بندی بلبرینگ');
  assert.ok(bearingProfile.primaryFacetOptions.some(opt => opt.value === '2RS'));
});

test('resolveSubcategoryThumb always returns a local /images/ path without external CDNs', () => {
  const cases = [
    ['سیم‌دار فابریک', 'تسمه تایمینگ', 'excel-v2-1-1'],
    ['لاستیکی فابریک', 'تسمه تایمینگ', 'excel-v2-1-1'],
    ['انواع گام و کدهای تایمینگ', 'تسمه تایمینگ', 'excel-v2-1-1'],
    ['کلاسیک و دنده‌دار', 'تسمه وی‌بلت (V-Belt)', 'excel-v2-1-2'],
    ['تسمه اسپشیال', 'تسمه وی‌بلت (V-Belt)', 'excel-v2-1-2'],
    ['وی‌بلت متری', 'تسمه وی‌بلت (V-Belt)', 'excel-v2-1-2'],
    ['بوش بغل رولر', 'قطعات رولر', 'excel-v2-3-2'],
    ['انواع بلبرینگ', 'بلبرینگ صنعتی', 'excel-v2-13-1'],
  ];
  for (const [sub, cat, slug] of cases) {
    const thumb = resolveSubcategoryThumb(sub, cat, slug);
    assert.ok(thumb.startsWith('/images/'), `Expected local /images/ asset for ${sub}, got ${thumb}`);
  }
});

test('buildPaginationWindow produces clean numbered windows with ellipsis', () => {
  assert.deepEqual(buildPaginationWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(buildPaginationWindow(1, 10), [1, 2, 3, 4, 'ellipsis', 10]);
  assert.deepEqual(buildPaginationWindow(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(buildPaginationWindow(9, 10), [1, 'ellipsis', 7, 8, 9, 10]);
});

test('buildSubcategoryStripNodes balances 3-child categories cleanly with an all-items card', () => {
  const strip = buildSubcategoryStripNodes(
    [{ name: 'سیم‌دار فابریک' }, { name: 'لاستیکی فابریک' }, { name: 'انواع گام و کدهای تایمینگ' }],
    'تسمه تایمینگ',
  );
  assert.equal(strip.length, 4);
  assert.equal(strip[3].isAllOption, true);
});

test('all 14 Excel groups, 34 categories, subcategories, and showroom photo resolve to existing local public/images files', () => {
  const assertPublicAsset = (assetPath: string, label: string) => {
    assert.ok(assetPath.startsWith('/images/'), `${label} should start with /images/, got ${assetPath}`);
    assert.ok(!/^https?:\/\//i.test(assetPath), `${label} must not use external CDN URL`);
    const diskPath = path.join(process.cwd(), 'public', assetPath.replace(/^\/+/, ''));
    assert.ok(fs.existsSync(diskPath), `${label} missing on disk at ${diskPath}`);
  };

  assertPublicAsset(STORE_ASSETS.companyPages.aboutSanatpishShowroom, 'HomeAbout showroom photo');

  for (const group of APPROVED_MENU_GROUPS) {
    const groupImg = resolveExcelCategoryArtwork(group.id, group.title, group.imageUrl);
    assertPublicAsset(groupImg, `Group ${group.id} (${group.title})`);
  }

  for (const cat of APPROVED_MENU_CATEGORIES) {
    const catImg = resolveExcelCategoryArtwork(cat.slug, cat.name, cat.image);
    assertPublicAsset(catImg, `Category ${cat.slug} (${cat.name})`);
    for (const sub of cat.children || []) {
      if (sub.hidden) continue;
      const subImg = resolveSubcategoryThumb(sub.name, cat.name, cat.slug);
      assertPublicAsset(subImg, `Subcategory ${cat.slug}/${sub.name}`);
    }
  }

  // Ensure domain-distinct categories do not collapse to the same image
  const distinctArt = new Set([
    resolveExcelCategoryArtwork('excel-v2-1-1', 'تسمه تایمینگ'),
    resolveExcelCategoryArtwork('excel-v2-1-2', 'تسمه وی‌بلت'),
    resolveExcelCategoryArtwork('excel-v2-1-4', 'تسمه بارکش'),
    resolveExcelCategoryArtwork('excel-v2-4-1', 'پولی'),
    resolveExcelCategoryArtwork('excel-v2-5-1', 'برس'),
    resolveExcelCategoryArtwork('excel-v2-6-1', 'ریل'),
    resolveExcelCategoryArtwork('excel-v2-6-4', 'سنسور'),
    resolveExcelCategoryArtwork('excel-v2-8-1', 'نوار برزنتی نسوز'),
    resolveExcelCategoryArtwork('excel-v2-10-1', 'اسپاتول'),
    resolveExcelCategoryArtwork('excel-v2-11-1', 'توری مش'),
    resolveExcelCategoryArtwork('excel-v2-13-1', 'بلبرینگ'),
    resolveExcelCategoryArtwork('excel-v2-14-1', 'اسفنج'),
  ]);
  assert.equal(distinctArt.size, 12, 'Domain categories must map to distinct bespoke artwork');
});
