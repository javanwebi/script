'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.PRODUCT_DETAIL_PREVIEW_URL || 'http://127.0.0.1:4173';
const familyCode = 'TEST-BRG-FAMILY';
const categorySlug = 'excel-v2-1-2';
const familyProduct = {
  code: familyCode,
  name: 'تسمه تایمینگ آزمایشی',
  nameEn: 'Test Timing Belt Family',
  brand: 'Test Bearing',
  categorySlug,
  categoryName: 'تسمه‌های صنعتی',
  submenu: 'بلبرینگ',
  subcategory: 'بلبرینگ',
  technicalSpecs: [
    { key: 'نوع خانواده', value: 'بلبرینگ شیار عمیق' },
    { key: 'برند', value: 'Test Bearing' },
    { key: 'واحد فروش', value: 'عدد' },
  ],
  description: 'شرح آزمایشی خانواده محصول برای آزمون رابط کاربری.',
  prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
  stock: 0,
  stockKnown: false,
  inquiryOnly: true,
  images: ['/storage/products/catalog/test-bearing-family.webp'],
  galleryImages: [
    {
      id: 'test-family-image',
      url: '/storage/products/catalog/test-bearing-family.webp',
      scope: 'family',
      title: 'تصویر مرجع خانواده بلبرینگ آزمایشی',
      order: 0,
    },
    {
      id: 'test-sku-image-001',
      url: '/storage/products/catalog/test-bearing-001.webp',
      scope: 'variant',
      variantCode: 'TEST-BRG-001',
      title: 'تصویر کد کالا TEST-BRG-001',
      order: 1,
    },
    {
      id: 'test-sku-image-002',
      url: '/storage/products/catalog/test-bearing-002.webp',
      scope: 'variant',
      variantCode: 'TEST-BRG-002',
      title: 'تصویر کد کالا TEST-BRG-002',
      order: 2,
    },
  ],
  hasCatalogueImage: true,
  tags: ['آزمایش'],
  unit: 'عدد',
  active: true,
  variants: [
    {
      code: 'TEST-BRG-001',
      name: 'تسمه تایمینگ آزمایشی 6205',
      size: '25 × 52 × 15 mm',
      model: '6205-2RS',
      brand: 'Test Bearing',
      unit: 'عدد',
      price: 0,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      stock: 0,
      stockKnown: false,
      inquiryOnly: true,
      active: true,
      images: ['/storage/products/catalog/test-bearing-001.webp'],
      technicalSpecs: [{ key: 'قطر داخلی', value: '25 mm' }, { key: 'قطر خارجی', value: '52 mm' }],
    },
    {
      code: 'TEST-BRG-002',
      name: 'تسمه تایمینگ آزمایشی 6206',
      size: '30 × 62 × 16 mm',
      model: '6206-2RS',
      brand: 'Test Bearing',
      unit: 'عدد',
      price: 0,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      stock: 0,
      stockKnown: false,
      inquiryOnly: true,
      active: true,
      images: ['/storage/products/catalog/test-bearing-002.webp'],
      technicalSpecs: [{ key: 'قطر داخلی', value: '30 mm' }, { key: 'قطر خارجی', value: '62 mm' }],
    },
  ],
};
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {},
  versions: {},
  productsIncluded: true,
  products: [familyProduct],
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
        if (url.includes('/api/catalog/reference/product/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              product: familyProduct,
              categoryMeta: { slug: categorySlug, name: 'تسمه‌های صنعتی' },
              similarProducts: [],
            }),
          });
        }
        if (url.includes('/api/catalog/variant-review/')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, technicalReview: null }),
          });
        }
        if (url.includes('/api/catalog/overrides')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null, user: null }) });
      });
      await page.route('**/storage/**', route => route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: tinyPng,
      }));

      await page.goto(baseUrl + '/product/TEST-BRG-001?source=responsive-smoke', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-testid="popd-product-detail"]').waitFor();
      await page.locator('h1').filter({ hasText: '6205' }).waitFor({ timeout: 25000 });

      const mainImage = page.locator('[data-testid="product-detail-image"] img').first();
      await mainImage.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('[data-testid="product-detail-image"] img')?.src.includes('test-bearing-001.webp'));
      await mainImage.evaluate(image => image.decode());
      assert.ok(await mainImage.evaluate(image => image.complete && image.naturalWidth > 0), 'selected SKU image should load');
      assert.ok((await mainImage.evaluate(image => image.src)).includes('test-bearing-001.webp'), 'main gallery must use the exact selected SKU image');
      assert.equal((await page.locator('[data-testid="active-sku-code"]').innerText()).trim(), 'TEST-BRG-001', 'main gallery must be paired with the exact selected SKU');

      const initialLayout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(initialLayout.document <= initialLayout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(initialLayout));
      assert.ok(initialLayout.body <= initialLayout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(initialLayout));

      const secondVariant = viewport.width < 768
        ? page.getByRole('button', { name: /انتخاب کد کالا TEST-BRG-002/ })
        : page.locator('[data-testid="belt-sku-selector"] tbody tr').filter({ hasText: 'TEST-BRG-002' }).first();
      await secondVariant.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="active-sku-code"]')?.textContent?.trim() === 'TEST-BRG-002');
      await page.waitForFunction(() => document.querySelector('[data-testid="product-detail-image"] img')?.src.includes('test-bearing-002.webp'));
      assert.equal(new URL(page.url()).searchParams.get('source'), 'responsive-smoke', 'SKU selection should preserve existing query parameters');
      assert.equal((await page.locator('[data-testid="active-sku-code"]').innerText()).trim(), 'TEST-BRG-002', 'the active SKU label should update without leaving the family page');

      const familyThumbnail = page.getByRole('button', { name: /نمایش تصویر عمومی خانواده/ }).first();
      await familyThumbnail.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="product-detail-image"] img')?.src.includes('test-bearing-family.webp'));
      assert.equal(await familyThumbnail.getAttribute('aria-pressed'), 'true', 'family reference thumbnail should become active');
      assert.equal(await page.getByText('تصویر مرجع خانواده', { exact: true }).isVisible(), true, 'family artwork must be visibly labelled as a family reference');
      assert.equal((await page.locator('[data-testid="active-sku-code"]').innerText()).trim(), 'TEST-BRG-002', 'choosing a family image must not silently change the selected SKU');

      const firstVariantThumbnail = page.getByRole('button', { name: /انتخاب تصویر کد TEST-BRG-001/ }).first();
      await firstVariantThumbnail.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="active-sku-code"]')?.textContent?.trim() === 'TEST-BRG-001');
      await page.waitForFunction(() => document.querySelector('[data-testid="product-detail-image"] img')?.src.includes('test-bearing-001.webp'));

      await page.getByRole('tab', { name: /مشخصات فنی کد و خانواده/ }).click();
      await page.getByText(/مشخصات کد انتخاب‌شده/).waitFor();
      assert.ok((await page.locator('[data-testid="active-sku-code"]').innerText()).includes('TEST-BRG-001'), 'technical tab should remain bound to the selected SKU');

      await page.getByRole('tab', { name: /شرایط تأمین، برش و ارسال/ }).click();
      await page.getByText('ارسال فوری از انبار مرکزی یزد').waitFor();
      await page.getByRole('tab', { name: /مشخصات فنی کد و خانواده/ }).click();

      if (viewport.width < 1024) {
        assert.ok(await page.locator('[data-testid="belt-mobile-sticky-bar"]').isVisible(), 'mobile/tablet sticky purchase access should be visible');
      } else {
        assert.equal(await page.locator('[data-testid="belt-mobile-sticky-bar"]').isVisible(), false, 'desktop should not show the mobile sticky bar');
        const galleryPosition = await page.locator('[data-testid="product-detail-gallery-sticky"]').evaluate(element => getComputedStyle(element).position);
        assert.equal(galleryPosition, 'sticky', 'desktop gallery should remain sticky while scrolling');
      }

      const finalLayout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(finalLayout.document <= finalLayout.viewport + 1, 'detail page overflow after interactions: ' + JSON.stringify(finalLayout));
      if (pageErrors.length) failures.push({ viewport, pageErrors });

      await page.screenshot({
        path: '/tmp/product-detail-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      console.log('PRODUCT_DETAIL_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(finalLayout));
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
