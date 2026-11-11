const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.BELT_PREVIEW_URL || 'http://127.0.0.1:4173';
const route = '/category/' + encodeURIComponent('تسمه-و-انتقال-نیرو');
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
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

      await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded' });
      await page.locator('main.bce').waitFor();
      await page.locator('.bce-family-tile').first().waitFor();
      await page.locator('.bce-products-list .bce-product-row').first().waitFor({ timeout: 20000 });

      const familyCount = await page.locator('.bce-family-tile').count();
      assert.equal(familyCount, 6, 'all existing belt families must remain available');

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));

      if (viewport.width > 980) {
        await page.locator('.bce-sidebar').waitFor({ state: 'visible' });
        await page.locator('.bce-featured-card').waitFor({ state: 'visible' });
      } else {
        await page.locator('.bce-featured-card').waitFor({ state: 'hidden' });
      }

      if (viewport.width <= 860) {
        await page.locator('.bce-mobile-tools > button').click();
        await page.getByRole('dialog', { name: 'فیلتر محصولات' }).waitFor({ state: 'visible' });
        const sheetOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(sheetOverflow <= 1, 'mobile filter sheet caused horizontal overflow');
        await page.locator('.bce-sheet button[aria-label="بستن فیلترها"]').click();
      }

      const rows = page.locator('.bce-products-list .bce-product-row');
      await rows.nth(0).locator('.bce-compare-select input').check({ force: true });
      await rows.nth(1).locator('.bce-compare-select input').check({ force: true });
      await page.locator('.bce-compare-open').click();
      const compareDialog = page.getByRole('dialog', { name: 'مقایسه محصولات انتخاب‌شده' });
      await compareDialog.waitFor({ state: 'visible' });
      await compareDialog.locator('.bce-compare-table').waitFor({ state: 'visible' });
      await compareDialog.locator('.bce-compare-head button').click();
      await page.locator('.bce-compare-clear').click();

      await page.screenshot({
        path: '/tmp/belt-category-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });

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
