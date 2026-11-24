'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.INDUSTRY_PREVIEW_URL || 'http://127.0.0.1:4173';
const industries = [
  { slug: 'ceramic', stages: 8 },
  { slug: 'textile', stages: 6 },
  { slug: 'packaging', stages: 8 },
  { slug: 'food', stages: 7 },
  { slug: 'machinery', stages: 7 },
  { slug: 'rubber', stages: 6 },
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {},
  versions: {},
  productsIncluded: true,
  products: [],
};

async function installRoutes(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/runtime') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(runtimeFixture),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null, user: null }),
    });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport,
        deviceScaleFactor: 1,
        locale: 'fa-IR',
        reducedMotion: 'reduce',
      });
      const pageErrors = [];
      page.setDefaultTimeout(20000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await installRoutes(page);

      await page.goto(baseUrl + '/industries', { waitUntil: 'domcontentloaded' });
      await page.locator('.company-page--industries').waitFor();
      await page.locator('.industry-directory-paths').waitFor();
      assert.equal(await page.locator('.company-industry-grid--editorial .company-industry-card').count(), 6);
      for (const href of ['/products', '/identify-part', '/ai-consult']) {
        assert.ok(await page.locator('.industry-directory-path[href="' + href + '"]').count() > 0,
          'directory must expose the real route ' + href);
      }
      let bounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      assert.ok(bounds.document <= bounds.viewport + 2,
        'industry directory horizontal overflow: ' + JSON.stringify(bounds));
      await page.screenshot({
        path: '/tmp/industry-experience-directory-' + viewport.width + '.png',
        fullPage: false,
        animations: 'disabled',
      });

      for (const industry of industries) {
        await page.goto(baseUrl + '/industries/' + industry.slug, { waitUntil: 'domcontentloaded' });
        await page.locator('.industry-template--' + industry.slug).waitFor();
        await page.locator('.ipt-process-map').waitFor();
        const nodes = page.locator('.ipt-stage-tabs button[role="tab"]');
        assert.equal(await nodes.count(), industry.stages,
          industry.slug + ' must expose every production stage');
        const first = nodes.first();
        await first.focus();
        await first.press('ArrowLeft');
        const keyboardSelected = nodes.nth(1);
        assert.equal(await keyboardSelected.getAttribute('aria-selected'), 'true',
          industry.slug + ' RTL ArrowLeft must select the next production stage');
        assert.equal(await keyboardSelected.evaluate(element => document.activeElement === element), true,
          industry.slug + ' keyboard navigation must move focus to the selected stage');

        const selected = keyboardSelected;
        await selected.click();
        assert.equal(await selected.getAttribute('aria-selected'), 'true',
          industry.slug + ' click selection must remain accessible');
        assert.equal(
          (await page.locator('#ipt-stage-panel h3').innerText()).trim(),
          await selected.getAttribute('data-stage-title'),
          industry.slug + ' stage details must follow the selected station',
        );
        const heroImage = page.locator('.ipt-hero-visual img');
        await heroImage.waitFor({ state: 'visible' });
        await heroImage.evaluate(image => image.decode());
        assert.ok(await heroImage.evaluate(image => image.complete && image.naturalWidth > 0),
          industry.slug + ' hero image must load');
        bounds = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
        }));
        assert.ok(bounds.document <= bounds.viewport + 2,
          industry.slug + ' horizontal overflow: ' + JSON.stringify(bounds));
        assert.deepEqual(pageErrors, [], industry.slug + ' browser page errors');
        if (viewport.width === 1440 || viewport.width === 390) {
          await page.screenshot({
            path: '/tmp/industry-experience-' + industry.slug + '-' + viewport.width + '.png',
            fullPage: false,
            animations: 'disabled',
          });
        }
        console.log('INDUSTRY_EXPERIENCE_OK', industry.slug, viewport.width);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
