const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.BELT_PREVIEW_URL || 'http://127.0.0.1:4173';
const route = '/category/' + encodeURIComponent('تسمه-و-انتقال-نیرو');
const beltSlug = 'تسمه-و-انتقال-نیرو';
const productFixture = [
  { code: 'A42', name: 'تسمه وی بلت کلاسیک A42', nameEn: 'Classic V-Belt A42', brand: 'Bando', categorySlug: beltSlug, categoryName: 'تسمه و انتقال نیرو', submenu: 'تسمه V-BELT', subcategory: 'کلاسیک', technicalSpecs: [{ key: 'پروفیل', value: 'A' }, { key: 'طول مؤثر', value: '1067 mm' }, { key: 'جنس', value: 'NR' }], prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 }, stock: 3, stockKnown: true, inquiryOnly: true, variants: [], images: [], tags: ['کلاسیک'], unit: 'عدد', active: true, featured: true },
  { code: 'SPA 1250', name: 'تسمه پروفیل باریک SPA 1250', nameEn: 'Narrow V-Belt SPA 1250', brand: 'Optibelt', categorySlug: beltSlug, categoryName: 'تسمه و انتقال نیرو', submenu: 'تسمه V-BELT', subcategory: 'پروفیل باریک', technicalSpecs: [{ key: 'پروفیل', value: 'SPA' }, { key: 'طول مؤثر', value: '1250 mm' }, { key: 'جنس', value: 'NR' }], prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 }, stock: 5, stockKnown: true, inquiryOnly: true, variants: [], images: [], tags: ['اسپشیال'], unit: 'عدد', active: true },
  { code: '8M-1200', name: 'تسمه تایمینگ 8M-1200', nameEn: 'Timing Belt 8M-1200', brand: 'Gates', categorySlug: beltSlug, categoryName: 'تسمه و انتقال نیرو', submenu: 'تسمه تایمینگ', subcategory: 'تسمه تایمینگ', technicalSpecs: [{ key: 'گام (Pitch)', value: '8 mm' }, { key: 'طول مؤثر', value: '1200 mm' }, { key: 'جنس', value: 'HNBR' }], prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 }, stock: 2, stockKnown: true, inquiryOnly: true, variants: [], images: [], tags: ['تایمینگ'], unit: 'عدد', active: true },
  { code: 'PK 8', name: 'تسمه شیاری PK 8', nameEn: 'Ribbed Belt PK 8', brand: 'Megadyne', categorySlug: beltSlug, categoryName: 'تسمه و انتقال نیرو', submenu: 'تسمه شیاری', subcategory: 'تسمه شیاری', technicalSpecs: [{ key: 'پروفیل', value: 'PK' }, { key: 'تعداد شیار', value: '8' }, { key: 'طول مؤثر', value: '800 mm' }], prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 }, stock: 0, stockKnown: true, inquiryOnly: true, variants: [], images: [], tags: ['شیاری'], unit: 'عدد', active: true },
  { code: 'PU-8', name: 'تسمه گرد پلی یورتان 8mm', nameEn: 'Round Polyurethane Belt 8mm', brand: 'Contitech', categorySlug: beltSlug, categoryName: 'تسمه و انتقال نیرو', submenu: 'تسمه گرد پلی اورتان', subcategory: 'تسمه گرد پلی اورتان', technicalSpecs: [{ key: 'قطر', value: '8 mm' }, { key: 'جنس', value: 'Polyurethane' }], prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 }, stock: 4, stockKnown: true, inquiryOnly: true, variants: [], images: [], tags: ['پلی یورتان'], unit: 'متر', active: true },
  { code: 'CRC-WELD-01', name: 'تسمه CRC پنج ضلعی جوشی پلی یورتان', nameEn: 'Welded Pentagonal Polyurethane Belt', brand: 'Mitsuboshi', categorySlug: beltSlug, categoryName: 'تسمه و انتقال نیرو', submenu: 'تسمه CRC پنج ضلعی', subcategory: 'تسمه CRC پنج ضلعی', technicalSpecs: [{ key: 'مقطع', value: 'پنج ضلعی' }, { key: 'اتصال', value: 'جوشی' }, { key: 'جنس', value: 'Polyurethane' }], prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 }, stock: 1, stockKnown: true, inquiryOnly: true, variants: [], images: [], tags: ['CRC', 'جوشی'], unit: 'متر', active: true },
];
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {},
  versions: {},
  productsIncluded: true,
  products: productFixture,
};

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
      page.setDefaultTimeout(12000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('**/api/runtime*', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(runtimeFixture),
      }));
      await page.route('**/api/catalog/overrides*', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      }));

      await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded' });
      await page.locator('main.bce').waitFor();
      await page.locator('.bce-family-tile').first().waitFor();
      await page.locator('.bce-products-list .bce-product-row').first().waitFor({ timeout: 20000 });

      const familyCount = await page.locator('.bce-family-tile').count();
      assert.equal(familyCount, 5, 'the five top-level belt families must remain available');
      const firstFourFamilies = (await page.locator('.bce-family-name').allTextContents()).slice(0, 4);
      assert.deepEqual(firstFourFamilies, ['وی بلت', 'تایمینگ', 'شیاری', 'پلی‌یورتان'], 'the first four family tiles must match the approved reference order');

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));

      const hero = page.locator('.bce-hero');
      await hero.waitFor({ state: 'visible' });
      const heroBox = await hero.boundingBox();
      const expectedHeroHeight = viewport.width <= 360 ? 114 : viewport.width <= 390 ? 118 : viewport.width <= 640 ? Math.max(112, Math.min(145, viewport.width * 0.32)) : Math.max(164, Math.min(205, viewport.width * 0.175));
      assert.ok(heroBox && Math.abs(heroBox.height - expectedHeroHeight) <= 2, 'unexpected hero height at ' + viewport.width + 'px: ' + JSON.stringify({ actual: heroBox?.height, expected: expectedHeroHeight }));
      await page.locator('.bce-hero-photo').waitFor({ state: 'visible' });
      await page.screenshot({
        path: '/tmp/belt-category-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });

      if (viewport.width > 980) {
        await page.locator('.bce-sidebar').waitFor({ state: 'visible' });
        await page.locator('.bce-featured-card').waitFor({ state: 'visible' });
        const positions = await page.evaluate(() => {
          const box = selector => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          };
          return {
            featured: box('.bce-featured-card'),
            results: box('.bce-results'),
            filters: box('.bce-sidebar'),
          };
        });
        assert.ok(positions.featured.left < positions.results.left && positions.results.left < positions.filters.left, 'desktop columns must be featured-left, products-center, filters-right: ' + JSON.stringify(positions));
      } else {
        await page.locator('.bce-featured-card').waitFor({ state: 'hidden' });
      }

      const rows = page.locator('.bce-products-list .bce-product-row');
      await page.locator('.bce-family-tile').first().click();
      assert.ok(page.url().includes('V-BELT'), 'the V-belt family tile must select the combined V-belt catalogue group');
      await page.locator('.bce-profile-row').waitFor({ state: 'visible' });
      const profileLabels = await page.locator('.bce-profile-buttons button').allTextContents();
      assert.ok(profileLabels.includes('A') && profileLabels.includes('SPA'), 'the V-belt profile choices must be derived from both classic and special profiles');
      await page.locator('.bce-family-area .bce-section-heading button').click();
      assert.ok(page.url().includes('sub=all'), 'returning to all families must restore the canonical catalogue');

      if (viewport.width <= 860) {
        await page.locator('.bce-mobile-tools > button').click();
        const filterDialog = page.getByRole('dialog', { name: 'فیلتر محصولات' });
        await filterDialog.waitFor({ state: 'visible' });
        const sheetOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(sheetOverflow <= 1, 'mobile filter sheet caused horizontal overflow');
        await filterDialog.locator('.bce-filter-brand-list label').filter({ hasText: 'Bando' }).locator('input').check({ force: true });
        await filterDialog.locator('footer button').last().click();
      } else {
        await page.locator('.bce-sidebar .bce-filter-brand-list label').filter({ hasText: 'Bando' }).locator('input').check({ force: true });
      }
      assert.equal(await rows.count(), 1, 'brand filter must reduce the list to the matching catalogue product');
      if (viewport.width <= 860) {
        await page.locator('.bce-mobile-tools > button').click();
        const filterDialog = page.getByRole('dialog', { name: 'فیلتر محصولات' });
        await filterDialog.waitFor({ state: 'visible' });
        await filterDialog.locator('footer button').first().click();
        await filterDialog.locator('footer button').last().click();
      } else {
        await page.locator('.bce-sidebar-top button').click();
      }
      assert.equal(await rows.count(), productFixture.length, 'clearing filters must restore the full live-fixture result set');
      await rows.nth(0).locator('.bce-compare-select input').check({ force: true });
      await rows.nth(1).locator('.bce-compare-select input').check({ force: true });
      await page.locator('.bce-compare-open').click();
      const compareDialog = page.getByRole('dialog', { name: 'مقایسه محصولات انتخاب‌شده' });
      await compareDialog.waitFor({ state: 'visible' });
      await compareDialog.locator('.bce-compare-table').waitFor({ state: 'visible' });
      await compareDialog.locator('.bce-compare-head button').click();
      await page.locator('.bce-compare-clear').click();

      await page.locator('.bce-family-area .bce-section-heading button').click();
      assert.ok(page.url().includes('sub=all'), 'the all-families action must preserve the canonical category route');

      if (pageErrors.length) failures.push({ viewport, pageErrors });
      console.log('BELT_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(layout));
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
