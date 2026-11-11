'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.LEGACY_CATEGORY_PREVIEW_URL || 'http://127.0.0.1:4173';
const categorySlug = 'مواد-و-ورق-صنعتی';
const categoryName = 'مواد و ورق صنعتی';
const familyImage = '/storage/products/11111111-1111-4111-8111-111111111111.webp';
const products = [
  {
    code: 'FAM-MAT-001',
    name: 'فوم صنعتی سلول‌بسته',
    nameEn: 'Industrial Closed-cell Foam',
    brand: 'FORZA',
    categorySlug,
    categoryName,
    submenu: 'فوم و اسفنج',
    subcategory: 'فوم صنعتی',
    technicalSpecs: [{ key: 'جنس', value: 'پلی‌یورتان' }, { key: 'ضخامت', value: '20 mm' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    variants: [],
    images: [],
    galleryImages: [{ id: 'gallery-family-1', scope: 'family', url: familyImage, identityVerified: true }],
    hasCatalogueImage: true,
    tags: ['فوم', 'پلی‌یورتان'],
    unit: 'ورق',
    active: true,
  },
  {
    code: 'FAM-MAT-002',
    name: 'ورق صنعتی نمونه بدون تصویر',
    nameEn: 'Industrial Sheet Sample',
    brand: 'ثبت نشده',
    categorySlug,
    categoryName,
    submenu: 'ورق صنعتی',
    subcategory: 'ورق پلیمری',
    technicalSpecs: [{ key: 'ضخامت', value: '5 mm' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    variants: [],
    images: [],
    galleryImages: [],
    hasCatalogueImage: false,
    tags: ['ورق'],
    unit: 'ورق',
    active: true,
  },
  {
    code: 'FAM-MAT-003',
    name: 'رول صنعتی با تصویر اختصاصی کد',
    nameEn: 'Industrial Roll with SKU Image',
    brand: 'FORZA',
    categorySlug,
    categoryName,
    submenu: 'رول صنعتی',
    subcategory: 'رول',
    technicalSpecs: [{ key: 'طول', value: '25 m' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    variants: [{
      code: 'SKU-MAT-003',
      size: '25 m',
      name: 'رول صنعتی 25 متری',
      images: ['/storage/products/22222222-2222-4222-8222-222222222222.webp'],
      active: true,
    }],
    images: ['/storage/products/22222222-2222-4222-8222-222222222222.webp'],
    galleryImages: [{
      id: 'gallery-variant-3',
      scope: 'variant',
      url: '/storage/products/22222222-2222-4222-8222-222222222222.webp',
      variantCode: 'SKU-MAT-003',
      identityVerified: true,
    }],
    imageScope: 'sku-verified',
    hasCatalogueImage: true,
    tags: ['رول'],
    unit: 'رول',
    active: true,
  },

];
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {
    atlas_admin_categories_v1: [{
      id: 81,
      slug: categorySlug,
      name: categoryName,
      nameEn: 'Industrial Materials & Sheets',
      description: 'فوم، اسفنج، ورق‌های صنعتی و مواد پلیمری ثبت‌شده در کاتالوگ.',
      icon: 'Package',
      count: products.length,
      familyCount: products.length,
      skuCount: products.length,
      active: true,
      children: [
        { name: 'فوم و اسفنج', children: [{ name: 'فوم صنعتی' }] },
        { name: 'ورق صنعتی', children: [{ name: 'ورق پلیمری' }] },
      ],
      subcategories: ['فوم و اسفنج', 'ورق صنعتی'],
    }],
  },
  versions: {},
  productsIncluded: true,
  products,
};
const directSku = {
  skuCode: 'SKU-MAT-001',
  name: 'قطعه مستقیم نمونه از ورق صنعتی',
  categorySlug,
  categoryName,
  submenu: 'ورق صنعتی',
  subcategory: 'ورق پلیمری',
  brand: 'FORZA',
  imageUrl: null,
  technicalSpecs: [{ key: 'ضخامت', value: '5 mm' }],
  priceSnapshot: {},
  active: true,
};
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ZkAAAAASUVORK5CYII=',
  'base64',
);
const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

async function installRoutes(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/runtime') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runtimeFixture) });
    }
    if (url.pathname === '/api/catalog/direct-skus') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, items: [directSku] }) });
    }
    if (url.pathname === '/api/catalog/overrides') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null, user: null }) });
  });
  await page.route('**/storage/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: tinyPng,
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'fa-IR' });
      const page = await context.newPage();
      const pageErrors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await installRoutes(page);

      await page.goto(baseUrl + '/category/' + encodeURIComponent(categorySlug), { waitUntil: 'domcontentloaded' });
      await page.locator('.category-showcase').waitFor();
      await page.getByRole('heading', { name: categoryName }).waitFor({ timeout: 25000 });
      await page.locator('.store-product-card').first().waitFor({ timeout: 25000 });

      assert.equal(await page.locator('.store-product-card').count(), products.length, 'legacy category should render only its matching family products');
      assert.equal(await page.locator('.category-product-headline strong').innerText(), 'محصولات ' + categoryName, 'the product heading must match the selected category');
      assert.equal(await page.getByText('انتخاب قطعات انتقال نیرو').count(), 0, 'a materials category must not inherit the power-transmission heading');
      assert.ok((await page.locator('.store-product-card').nth(1).locator('.store-product-meta').innerText()).includes('برند ثبت نشده'), 'placeholder brand values should be presented honestly');

      const familyImageElement = page.locator('.store-product-card').first().locator('.store-product-media img');
      await familyImageElement.waitFor({ state: 'visible' });
      await familyImageElement.evaluate(image => image.decode());
      assert.ok(await familyImageElement.evaluate(image => image.complete && image.naturalWidth > 0), 'family gallery image should fill the product card');

      const missingImage = page.locator('.store-product-card').nth(1).locator('.store-product-media [role="img"]');
      await missingImage.waitFor({ state: 'visible' });
      const placeholderBox = await missingImage.boundingBox();
      assert.ok(placeholderBox && placeholderBox.width > 100 && placeholderBox.height > 100, 'missing-image state should fill the media frame rather than collapse to a small icon');
      const skuPreviewBadge = page.locator('.store-product-card').nth(2).locator('.store-product-image-scope-badge');
      await skuPreviewBadge.waitFor({ state: 'visible' });
      assert.ok((await skuPreviewBadge.innerText()).includes('SKU-MAT-003'), 'SKU-bound image must be labelled with the exact variant code');

      const firstHref = await page.locator('.store-product-card').first().locator('.store-product-title').getAttribute('href');
      assert.equal(firstHref, '/product/FAM-MAT-001', 'public category card should keep the public product detail route');

      const familyGrid = page.locator('.category-showcase-shop').first();
      const directHeading = page.getByRole('heading', { name: 'کدهای کالای مستقیم این گروه' });
      await directHeading.waitFor({ state: 'visible' });
      const directSection = directHeading.locator('xpath=ancestor::section[1]');
      const followsFamilyGrid = await page.evaluate(({ familySelector, directSelector }) => {
        const family = document.querySelector(familySelector);
        const direct = document.querySelector(directSelector);
        return Boolean(family && direct && (family.compareDocumentPosition(direct) & Node.DOCUMENT_POSITION_FOLLOWING));
      }, { familySelector: '.category-showcase-shop', directSelector: '.category-showcase > section.space-y-4.rounded-2xl' });
      assert.ok(followsFamilyGrid, 'direct SKU section must follow the family product catalogue');
      assert.equal(await directSection.locator('a[href="/direct-product/SKU-MAT-001"]').count(), 1, 'direct SKU should open its own canonical detail page');

      const cardHeights = await page.locator('.store-product-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height));
      assert.ok(cardHeights.every(height => height < 440), 'category product cards should no longer keep the obsolete 440px minimum height: ' + JSON.stringify(cardHeights));

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));
      if (pageErrors.length) failures.push({ viewport, pageErrors });

      await page.screenshot({
        path: '/tmp/legacy-category-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      console.log('LEGACY_CATEGORY_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(layout));
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fa-IR' });
    const page = await context.newPage();
    await installRoutes(page);
    await page.goto(baseUrl + '/category/unknown-legacy-category', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'این دسته‌بندی در کاتالوگ فعال نیست' }).waitFor({ timeout: 25000 });
    assert.equal(await page.locator('.store-product-card').count(), 0, 'unknown categories must not show the first unrelated category');
    assert.equal(await page.locator('a[href="/categories"]').count(), 1, 'unknown category should point back to the category directory');
    assert.equal(await page.locator('a[href="/products"]').count(), 1, 'unknown category should expose the all-products route');
    await context.close();

    assert.deepEqual(failures, [], 'browser page errors were detected');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
