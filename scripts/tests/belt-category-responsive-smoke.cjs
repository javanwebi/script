const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.BELT_PREVIEW_URL || 'http://127.0.0.1:4173';
const legacyRoute = '/category/' + encodeURIComponent('تسمه-و-انتقال-نیرو');
const viewports = [
  { width: 1440, height: 900 },
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

      await page.goto(baseUrl + legacyRoute, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(url => url.pathname === '/categories', { timeout: 20000 });
      assert.equal(new URL(page.url()).pathname, '/categories',
        'the retired belt catch-all route must redirect to the approved category directory');
      await page.locator('main').first().waitFor({ state: 'visible' });
      assert.equal(await page.locator('.bce').count(), 0,
        'the retired mixed-family BeltCategoryExperience must not render on the old URL');

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1,
        'category directory overflow after legacy redirect: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1,
        'category directory body overflow after legacy redirect: ' + JSON.stringify(layout));

      await page.screenshot({
        path: '/tmp/belt-category-legacy-redirect-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      if (pageErrors.length) failures.push({ viewport, pageErrors });
      console.log('BELT_LEGACY_REDIRECT_OK', viewport.width + 'x' + viewport.height, JSON.stringify(layout));
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
