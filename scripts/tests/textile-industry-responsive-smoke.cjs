'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.TEXTILE_PREVIEW_URL || 'http://127.0.0.1:4173';
const textileProduct = {
  code: 'TEST-TEXTILE-001',
  name: 'تسمه صنعتی مخصوص خط نساجی',
  nameEn: 'Textile Production Industrial Belt',
  brand: 'Test Textile',
  categorySlug: 'excel-v2-1-1',
  categoryName: 'نساجی',
  submenu: 'تسمه',
  subcategory: 'ریسندگی',
  technicalSpecs: [
    { key: 'عرض', value: '20 mm' },
    { key: 'کاربرد', value: 'ریسندگی' },
  ],
  prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
  stock: 0,
  stockKnown: false,
  inquiryOnly: true,
  variants: [],
  images: ['/storage/products/catalog/e(1).png'],
  tags: ['نساجی', 'ریسندگی', 'تسمه'],
  unit: 'عدد',
  active: true,
  hasCatalogueImage: true,
};
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {},
  versions: {},
  productsIncluded: true,
  products: [textileProduct],
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
  await page.route('**/storage/**', route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: tinyPng,
  }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        locale: 'fa-IR',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => pageErrors.push(error.message));
      await installRoutes(page);
      await page.goto(baseUrl + '/industries/textile', { waitUntil: 'domcontentloaded' });
      await page.locator('.industry-template--textile').waitFor();
      await page.getByRole('heading', { name: 'تأمین قطعات و پشتیبانی فنی خطوط نساجی و پارچه' }).waitFor({ timeout: 25000 });

      const heroImage = page.locator('.ipt-hero-visual img');
      await heroImage.waitFor({ state: 'visible' });
      await heroImage.evaluate(image => image.decode());
      assert.ok(await heroImage.evaluate(image => image.complete && image.naturalWidth > 0), 'textile industrial image should load');

      const heroLayout = await page.evaluate(() => {
        const visual = document.querySelector('.ipt-hero-visual').getBoundingClientRect();
        const copy = document.querySelector('.ipt-hero-copy').getBoundingClientRect();
        return {
          viewport: window.innerWidth,
          visualX: visual.x,
          visualY: visual.y,
          copyX: copy.x,
          copyY: copy.y,
        };
      });
      if (viewport.width > 760) {
        assert.ok(heroLayout.visualX > heroLayout.copyX, 'industrial image should be on the right of the text on desktop');
      } else {
        assert.ok(heroLayout.visualY < heroLayout.copyY, 'industrial image should appear before copy on mobile');
      }

      const productCards = page.locator('.ipt-catalog .store-product-card');
      await productCards.first().waitFor({ timeout: 25000 });
      assert.equal(await productCards.count(), 1, 'only the active textile catalogue family fixture should render');

      const weavingStage = page.locator('.ipt-stage-tabs button').nth(1);
      await weavingStage.click();
      assert.equal(await weavingStage.getAttribute('aria-selected'), 'true', 'selected textile stage should expose its state');
      assert.equal(await page.locator('.ipt-stage-copy h3').innerText(), 'ریسندگی', 'stage details should update interactively');
      const relatedLink = page.locator('.ipt-stage-copy a').first();
      assert.ok((await relatedLink.getAttribute('href')).startsWith('/products?q='), 'stage-specific catalog search should be linked');

      const forzaLink = page.locator('.ipt-hero-actions a').nth(1);
      assert.ok((await forzaLink.getAttribute('href')).includes('/ai-consult?industry=textile'), 'hero FORZA consultation should keep its industry context');
      const visualIdentification = page.locator('.ipt-hero-actions a').nth(2);
      assert.ok((await visualIdentification.getAttribute('href')).includes('/identify-part'), 'image identification should use the canonical route');

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));
      assert.deepEqual(pageErrors, [], 'browser page errors were detected');

      await page.screenshot({
        path: '/tmp/textile-industry-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      console.log('TEXTILE_INDUSTRY_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(heroLayout), JSON.stringify(layout));
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
