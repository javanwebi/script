'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.BELT_PREVIEW_URL || 'http://127.0.0.1:4173';
const categories = [
  { slug: 'excel-v2-1-1', routeSlug: 'تسمه-تایمینگ-صنعتی', name: 'تسمه تایمینگ' },
  { slug: 'excel-v2-1-2', routeSlug: 'تسمه-وی-بلت-صنعتی', name: 'تسمه وی‌بلت (V-Belt)' },
  { slug: 'excel-v2-1-3', routeSlug: 'تسمه-جوشی-صنعتی', name: 'تسمه جوشی با سایت' },
  { slug: 'excel-v2-1-4', routeSlug: 'تسمه-بارکش-صنعتی', name: 'تسمه بارکش و تجهیزات جوشی' },
].map(category => ({
  ...category,
  routeSlug: category.routeSlug,
  active: true,
  description: 'کاتالوگ تخصصی ' + category.name,
  image: null,
  familyCount: 0,
  skuCount: 0,
  children: [{ name: 'زیرگروه‌های تخصصی', children: [{ name: 'مدل‌های ثبت‌شده' }] }],
}));
const group = {
  id: 'excel-v2-1',
  title: 'انواع تسمه‌های صنعتی',
  iconKey: 'layers',
  imageUrl: null,
  categorySlugs: categories.map(category => category.slug),
  sortOrder: 0,
  active: true,
};
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {},
  versions: {},
  productsIncluded: true,
  products: [],
};
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ZkAAAAASUVORK5CYII=',
  'base64',
);

async function installRoutes(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/runtime') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runtimeFixture) });
    }
    if (url.pathname === '/api/catalog/categories') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, categories }) });
    }
    if (url.pathname === '/api/catalog/navigation-groups') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, groups: [group] }) });
    }
    if (url.pathname.startsWith('/api/catalog/menu-category/')) {
      const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
      const category = categories.find(item => item.slug === slug);
      return route.fulfill({
        status: category ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(category ? { success: true, category, families: [] } : { success: false }),
      });
    }
    if (url.pathname === '/api/catalog/direct-skus') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, items: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null, user: null }) });
  });
  await page.route('**/images/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng }));
  await page.route('**/storage/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng }));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'fa-IR', reducedMotion: 'reduce' });
      for (const category of categories) {
        const page = await context.newPage();
        const pageErrors = [];
        page.setDefaultTimeout(15000);
        page.on('pageerror', error => pageErrors.push(error.message));
        await installRoutes(page);
        await page.goto(baseUrl + '/category/' + encodeURIComponent(category.routeSlug), { waitUntil: 'domcontentloaded' });
        await page.locator('.excel-category-page').waitFor();
        await page.getByRole('heading', { name: category.name }).waitFor({ timeout: 20000 });
        const expectedPath = new URL(baseUrl + '/category/' + encodeURIComponent(category.routeSlug)).pathname;
        assert.equal(new URL(page.url()).pathname, expectedPath, 'category must retain its unique Persian SEO URL: ' + page.url());
        assert.equal(await page.locator('.excel-category-results').count(), 1, 'canonical category must render its own product results region');
        const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        assert.ok(layout.document <= layout.viewport + 1, 'category page horizontal overflow: ' + JSON.stringify(layout));
        assert.ok(layout.body <= layout.viewport + 1, 'category body horizontal overflow: ' + JSON.stringify(layout));
        if (pageErrors.length) failures.push({ viewport, category: category.slug, pageErrors });
        await page.screenshot({ path: '/tmp/belt-category-' + category.slug + '-' + viewport.width + '.png', fullPage: false, animations: 'disabled' });
        console.log('BELT_SEO_ROUTE_OK', category.routeSlug, viewport.width + 'px', JSON.stringify(layout));
        await page.close();
      }
      const internalIdPage = await context.newPage();
      await installRoutes(internalIdPage);
      await internalIdPage.goto(baseUrl + '/category/' + categories[0].slug, { waitUntil: 'domcontentloaded' });
      await internalIdPage.waitForURL(url => url.pathname === new URL(baseUrl + '/category/' + encodeURIComponent(categories[0].routeSlug)).pathname, { timeout: 15000 });
      console.log('BELT_INTERNAL_ID_CANONICALIZED', categories[0].slug, internalIdPage.url());
      await internalIdPage.close();

      const legacyPage = await context.newPage();
      const legacyErrors = [];
      legacyPage.on('pageerror', error => legacyErrors.push(error.message));
      await installRoutes(legacyPage);
      await legacyPage.goto(baseUrl + '/category/' + encodeURIComponent('تسمه-و-انتقال-نیرو'), { waitUntil: 'domcontentloaded' });
      await legacyPage.waitForURL(url => url.pathname === '/categories' && url.searchParams.get('group') === 'excel-v2-1', { timeout: 15000 });
      await legacyPage.locator('.all-categories-page').waitFor();
      assert.equal(new URL(legacyPage.url()).searchParams.get('group'), 'excel-v2-1', 'legacy belt URL must redirect to the new industrial-belts group');
      if (legacyErrors.length) failures.push({ viewport, category: 'legacy-belt-route', pageErrors: legacyErrors });
      console.log('BELT_LEGACY_REDIRECT_OK', viewport.width + 'px', legacyPage.url());
      await legacyPage.close();
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
