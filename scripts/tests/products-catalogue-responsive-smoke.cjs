'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.PRODUCTS_PREVIEW_URL || 'http://127.0.0.1:4173';
const categorySlug = 'بلبرینگ-و-یاتاقان';
const categoryName = 'بلبرینگ و یاتاقان';
const products = [
  {
    code: 'TEST-BRG-001',
    name: 'بلبرینگ آزمایشی شیار عمیق 6205',
    nameEn: 'Test Deep Groove Bearing 6205',
    brand: 'Test Bearing',
    categorySlug,
    categoryName,
    submenu: 'بلبرینگ',
    subcategory: 'بلبرینگ',
    technicalSpecs: [{ key: 'قطر داخلی', value: '25 mm' }, { key: 'نوع', value: 'شیار عمیق' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 7,
    stockKnown: true,
    inquiryOnly: false,
    variants: [],
    images: ['/storage/products/catalog/e(1).png'],
    hasCatalogueImage: true,
    tags: ['آزمایش'],
    unit: 'عدد',
    active: true,
  },
  {
    code: 'TEST-BRG-002',
    name: 'بلبرینگ آزمایشی شیار عمیق 6206',
    nameEn: 'Test Deep Groove Bearing 6206',
    brand: 'Test Bearing',
    categorySlug,
    categoryName,
    submenu: 'بلبرینگ',
    subcategory: 'بلبرینگ',
    technicalSpecs: [{ key: 'قطر داخلی', value: '30 mm' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    variants: [],
    images: [],
    hasCatalogueImage: false,
    tags: ['آزمایش'],
    unit: 'عدد',
    active: true,
  },
  {
    code: 'TEST-BRG-003',
    name: 'یاتاقان آزمایشی صنعتی',
    nameEn: 'Test Industrial Bearing Housing',
    brand: 'Test Motion',
    categorySlug,
    categoryName,
    submenu: 'یاتاقان',
    subcategory: 'یاتاقان',
    technicalSpecs: [{ key: 'جنس', value: 'چدن' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: true,
    inquiryOnly: true,
    variants: [],
    images: [],
    hasCatalogueImage: false,
    tags: ['آزمایش'],
    unit: 'عدد',
    active: true,
  },
];
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {
    atlas_admin_categories_v1: [{
      id: 1,
      slug: categorySlug,
      name: categoryName,
      nameEn: 'Bearings & Bushings',
      description: 'بلبرینگ و یاتاقان',
      icon: 'Package',
      count: products.length,
      familyCount: products.length,
      skuCount: products.length,
      active: true,
      children: [{ name: 'بلبرینگ', children: [] }, { name: 'یاتاقان', children: [] }],
      subcategories: ['بلبرینگ', 'یاتاقان'],
    }],
  },
  versions: {},
  productsIncluded: true,
  products,
};
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ZkAAAAASUVORK5CYII=',
  'base64',
);
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 724 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const pageErrors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('**/api/**', async route => {
        const url = route.request().url();
        if (url.includes('/api/runtime')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runtimeFixture) });
        }
        if (url.includes('/api/catalog/overrides')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null, user: null }) });
      });
      await page.route('**/storage/products/**', route => route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: tinyPng,
      }));

      await page.goto(baseUrl + '/products', { waitUntil: 'domcontentloaded' });
      await page.locator('.catalogue-premium-page').waitFor();
      await page.locator('.store-product-card').first().waitFor({ timeout: 25000 });

      assert.equal(await page.locator('.store-product-card').count(), products.length, 'all database-fixture product families should render');
      assert.equal(await page.locator('.catalogue-category-tile:not(.catalogue-category-tile--all)').count(), 1, 'the PostgreSQL-backed category rail should render the active category');

      const hero = page.locator('.catalogue-hero');
      await hero.waitFor({ state: 'visible' });
      if (viewport.width <= 640) {
        // Compact mobile layout keeps the editorial hero copy and intentionally
        // hides the large desktop artwork to preserve the first-screen space.
        await page.locator('.catalogue-hero-copy').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.catalogue-hero-art').isVisible(), false,
          'large desktop hero artwork should stay collapsed in compact mobile layout');
      } else {
        const heroImage = page.locator('.catalogue-hero-art img');
        await heroImage.waitFor({ state: 'visible' });
        await heroImage.evaluate(image => image.decode());
        assert.ok(await heroImage.evaluate(image => image.complete && image.naturalWidth > 0), 'industrial hero image should load');
      }

      const layout = await page.evaluate(() => {
        const offenders = [...document.querySelectorAll('body *')].map(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            id: element.id,
            className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            overflowX: style.overflowX,
          };
        }).filter(item => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
          .sort((a, b) => (b.right - window.innerWidth) - (a.right - window.innerWidth))
          .slice(0, 18);
        return {
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          offenders,
        };
      });
      if (layout.document > layout.viewport + 1 || layout.body > layout.viewport + 1) {
        console.log('PRODUCTS_CATALOGUE_OVERFLOW', JSON.stringify(layout));
        await page.screenshot({ path: '/tmp/products-catalogue-overflow-' + viewport.width + '.png', fullPage: true });
      }
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));

      const search = page.getByLabel('جست‌وجو بر اساس نام، کد فنی، برند یا مشخصات');
      await search.fill('6205');
      assert.ok(page.url().includes('q=6205'), 'search text should be reflected in the shareable URL');
      assert.equal(await page.locator('.store-product-card').count(), 1, 'search should narrow to the matching code/name');
      await page.getByRole('button', { name: 'پاک کردن' }).click();
      assert.ok(!new URL(page.url()).searchParams.has('q'), 'clearing search should remove q from the URL');
      assert.equal(await page.locator('.store-product-card').count(), products.length, 'clearing search should restore the result set');

      const categoryTile = page.locator('.catalogue-category-tile:not(.catalogue-category-tile--all)').first();
      await categoryTile.click();
      assert.ok(new URL(page.url()).searchParams.has('category'), 'category selection should be linkable');
      assert.equal(await page.locator('.store-product-card').count(), products.length, 'the selected category should retain its products');
      await page.locator('.catalogue-category-tile--all').click();

      if (viewport.width <= 640) {
        const filterTrigger = page.locator('.catalogue-mobile-filter-trigger');
        await filterTrigger.click();
        const dialog = page.getByRole('dialog', { name: 'فیلترهای محصولات' });
        await dialog.waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'mobile filter sheet should lock background scrolling');
        await page.keyboard.press('Shift+Tab');
        assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'keyboard focus should stay inside the mobile filter sheet');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'closing the sheet should restore body scrolling');

        await filterTrigger.click();
        const sheet = page.locator('.catalogue-filter-sheet');
        await sheet.locator('select').selectOption('Test Bearing');
        await sheet.locator('.catalogue-sheet-apply').click();
      } else {
        await page.locator('.catalogue-filter-brand select').selectOption('Test Bearing');
      }
      assert.equal(await page.locator('.store-product-card').count(), 2, 'brand filter should return the two matching products');
      assert.ok(new URL(page.url()).searchParams.get('brand') === 'Test Bearing', 'brand selection should be reflected in the URL');

      if (viewport.width <= 640) {
        await page.locator('.catalogue-mobile-filter-trigger').click();
        const sheet = page.locator('.catalogue-filter-sheet');
        await sheet.locator('.catalogue-sheet-clear').click();
        await sheet.locator('.catalogue-sheet-apply').click();
      } else {
        await page.locator('.catalogue-filter-brand select').selectOption('all');
      }
      assert.equal(await page.locator('.store-product-card').count(), products.length, 'clearing brand should restore all products');

      if (viewport.width <= 640) {
        await page.locator('.catalogue-mobile-filter-trigger').click();
        const sheet = page.locator('.catalogue-filter-sheet');
        await sheet.locator('.catalogue-sheet-check').first().locator('input').check();
        await sheet.locator('.catalogue-sheet-apply').click();
      } else {
        await page.locator('.catalogue-desktop-stock-filter input').check();
      }
      assert.equal(await page.locator('.store-product-card').count(), 1, 'confirmed-stock filter must exclude unknown and inquiry-only inventory');
      assert.equal(new URL(page.url()).searchParams.get('stock'), '1', 'stock filter should be reflected in the URL');

      if (viewport.width <= 640) {
        await page.locator('.catalogue-mobile-filter-trigger').click();
        const sheet = page.locator('.catalogue-filter-sheet');
        await sheet.locator('.catalogue-sheet-clear').click();
        await sheet.locator('.catalogue-sheet-apply').click();
      } else {
        await page.locator('.catalogue-desktop-stock-filter input').uncheck();
      }
      assert.equal(await page.locator('.store-product-card').count(), products.length, 'clearing stock filter should restore all products');

      if (viewport.width <= 640) {
        await page.locator('.catalogue-mobile-filter-trigger').click();
        const sheet = page.locator('.catalogue-filter-sheet');
        await sheet.locator('.catalogue-sheet-check').last().locator('input').check();
        await sheet.locator('.catalogue-sheet-apply').click();
      } else {
        await page.locator('.catalogue-desktop-image-filter input').check();
      }
      assert.equal(await page.locator('.store-product-card').count(), 1, 'catalogue-image filter should return only families with a registered image');

      const productHref = await page.locator('.store-product-title').first().getAttribute('href');
      assert.equal(productHref, '/product/TEST-BRG-001', 'product card should retain the canonical product detail destination');

      await page.screenshot({
        path: '/tmp/products-catalogue-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      if (pageErrors.length) failures.push({ viewport, pageErrors });
      console.log('PRODUCTS_CATALOGUE_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(layout));
      await context.close();
    }
    assert.deepEqual(failures, [], 'browser page errors were detected');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
