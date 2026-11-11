'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.PRODUCT_DETAIL_PREVIEW_URL || 'http://127.0.0.1:4173';
const familyCode = 'TEST-BRG-FAMILY';
const categorySlug = 'بلبرینگ-و-یاتاقان';
const familyProduct = {
  code: familyCode,
  name: 'بلبرینگ آزمایشی شیار عمیق',
  nameEn: 'Test Deep Groove Bearing Family',
  brand: 'Test Bearing',
  categorySlug,
  categoryName: 'بلبرینگ و یاتاقان',
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
  images: ['/storage/products/catalog/e(1).png'],
  hasCatalogueImage: true,
  tags: ['آزمایش'],
  unit: 'عدد',
  active: true,
  variants: [
    {
      code: 'TEST-BRG-001',
      name: 'بلبرینگ آزمایشی شیار عمیق 6205',
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
      images: ['/storage/products/catalog/e(2).png'],
      technicalSpecs: [{ key: 'قطر داخلی', value: '25 mm' }, { key: 'قطر خارجی', value: '52 mm' }],
    },
    {
      code: 'TEST-BRG-002',
      name: 'بلبرینگ آزمایشی شیار عمیق 6206',
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
      images: ['/storage/products/catalog/e(3).png'],
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
      await page.locator('.product-detail-premium').waitFor();
      await page.locator('h1').filter({ hasText: '6205' }).waitFor({ timeout: 25000 });

      const mainImage = page.locator('.product-detail-image img').first();
      await mainImage.waitFor({ state: 'visible' });
      await mainImage.evaluate(image => image.decode());
      assert.ok(await mainImage.evaluate(image => image.complete && image.naturalWidth > 0), 'selected SKU image should load');
      assert.ok((await page.locator('.product-detail-image').innerText()).includes('TEST-BRG-001'), 'main gallery should identify the exact selected SKU image');

      const initialLayout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(initialLayout.document <= initialLayout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(initialLayout));
      assert.ok(initialLayout.body <= initialLayout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(initialLayout));

      const secondVariant = page.getByRole('button', { name: /انتخاب کد کالا TEST-BRG-002/ });
      await secondVariant.click();
      await page.waitForURL(/TEST-BRG-002/);
      assert.equal(new URL(page.url()).searchParams.get('source'), 'responsive-smoke', 'SKU navigation should preserve existing query parameters');
      await page.locator('h1').filter({ hasText: '6206' }).waitFor();
      assert.ok((await page.locator('.product-detail-breadcrumbs').innerText()).includes('TEST-BRG-002'), 'breadcrumb should reflect the selected SKU');

      const familyThumbnail = page.getByRole('button', { name: /نمایش تصویر عمومی خانواده/ }).first();
      await familyThumbnail.click();
      assert.ok((await page.locator('.product-detail-image').innerText()).includes('تصویر عمومی خانواده محصول'), 'family reference image must be clearly labelled');
      assert.ok((await page.locator('.product-detail-breadcrumbs').innerText()).includes('TEST-BRG-002'), 'choosing a family image must not silently change the selected SKU');
      assert.ok(page.url().includes('TEST-BRG-002'), 'family image selection should keep the selected SKU route');

      const firstVariantThumbnail = page.getByRole('button', { name: /انتخاب تصویر کد TEST-BRG-001/ }).first();
      await firstVariantThumbnail.click();
      await page.waitForURL(/TEST-BRG-001/);
      await page.locator('h1').filter({ hasText: '6205' }).waitFor();

      await page.getByRole('tab', { name: /شناسنامه کد و تطبیق با کاتالوگ/ }).click();
      await page.getByText('شناسه‌ها و مدارک محصول').waitFor();
      assert.ok((await page.locator('#product-detail-tab-panel').innerText()).includes('TEST-BRG-001'), 'catalogue tab should show the selected SKU identifier');

      await page.getByRole('tab', { name: /انبارداری یزد/ }).click();
      await page.getByText('انبارداری، لجستیک و تحویل کالا از انبار مرکزی یزد').waitFor();
      await page.getByRole('tab', { name: /مشخصات فنی/ }).click();

      if (viewport.width < 1024) {
        assert.ok(await page.locator('.product-detail-mobile-action').isVisible(), 'mobile/tablet sticky purchase access should be visible');
      } else {
        assert.equal(await page.locator('.product-detail-mobile-action').isVisible(), false, 'desktop should not show the mobile sticky bar');
        const galleryPosition = await page.locator('.product-detail-gallery').evaluate(element => getComputedStyle(element).position);
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
