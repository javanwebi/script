'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.ALL_CATEGORIES_PREVIEW_URL || 'http://127.0.0.1:4173';
const categories = [
  {
    id: 101,
    slug: 'excel-v2-1-1',
    name: 'تسمه تایمینگ',
    nameEn: 'Timing Belts',
    description: 'تسمه‌های دندانه‌دار برای انتقال حرکت هماهنگ در تجهیزات صنعتی.',
    icon: 'Layers',
    image: null,
    active: true,
    familyCount: 284,
    skuCount: 1285,
    count: 284,
    children: [
      { name: 'سیم‌دار فابریک', children: [{ name: 'پلی‌یورتان' }, { name: 'کامیون‌دار کلیددار' }] },
      { name: 'لاستیکی فابریک', children: [{ name: 'ساده و دنده‌دار' }] },
    ],
  },
  {
    id: 102,
    slug: 'excel-v2-1-2',
    name: 'تسمه وی‌بلت',
    nameEn: 'V-Belts',
    description: 'گروه تسمه‌های انتقال قدرت با پروفیل‌های مختلف.',
    icon: 'Layers',
    image: null,
    active: true,
    familyCount: 174,
    skuCount: 4554,
    count: 174,
    children: [{ name: 'پروفیل کلاسیک', children: [{ name: 'A' }, { name: 'B' }] }],
  },
  {
    id: 201,
    slug: 'excel-v2-2-1',
    name: 'نوار نقاله صنعتی',
    nameEn: 'Industrial Conveyor Belts',
    description: 'مسیر انتخاب نوار و تجهیزات انتقال مواد در خطوط تولید.',
    icon: 'Package',
    image: null,
    active: true,
    familyCount: 2,
    skuCount: 187,
    count: 2,
    children: [{ name: 'نوار لاستیکی', children: [] }, { name: 'نوار PVC', children: [] }],
  },
];
const groups = [
  {
    id: 'excel-v2-1',
    title: 'انواع تسمه‌های صنعتی',
    iconKey: 'layers',
    sortOrder: 0,
    active: true,
    categorySlugs: ['excel-v2-1-1', 'excel-v2-1-2'],
  },
  {
    id: 'excel-v2-2',
    title: 'نوارهای نقاله و انتقال مواد',
    iconKey: 'layers',
    sortOrder: 1,
    active: true,
    categorySlugs: ['excel-v2-2-1'],
  },
];
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

async function installApiRoutes(page, fallbackMode = false) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (fallbackMode && (
      url.pathname === '/api/catalog/categories' ||
      url.pathname === '/api/catalog/navigation-groups'
    )) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) });
    }
    if (url.pathname === '/api/catalog/categories') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, categories }),
      });
    }
    if (url.pathname === '/api/catalog/navigation-groups') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, groups }),
      });
    }
    if (url.pathname === '/api/runtime') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          database: true,
          userId: null,
          values: {},
          versions: {},
          productsIncluded: true,
          products: [],
        }),
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
  const failures = [];
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
      await installApiRoutes(page);
      await page.goto(baseUrl + '/categories', { waitUntil: 'domcontentloaded' });
      await page.locator('.all-categories-page').waitFor();
      await page.getByText('ساختار دسته‌بندی از پایگاه داده دریافت شد').waitFor({ timeout: 25000 });

      assert.equal(await page.locator('.all-categories-card').count(), 3, 'all active database-backed categories should render');
      assert.equal(await page.locator('.all-categories-group').count(), 2, 'approved navigation groups should remain grouped');
      assert.equal(await page.locator('.all-categories-group-nav a').count(), 2, 'quick-jump navigation should mirror the visible groups');

      const heroImage = page.locator('.all-categories-hero-visual img');
      await heroImage.waitFor({ state: 'visible' });
      await heroImage.evaluate(image => image.decode());
      assert.ok(await heroImage.evaluate(image => image.complete && image.naturalWidth > 0), 'industrial hero image should load');

      const categoryImages = page.locator('.all-categories-card-art img');
      assert.equal(await categoryImages.count(), 3, 'existing category imagery should be reused where a suitable asset exists');
      for (let i = 0; i < await categoryImages.count(); i += 1) {
        const image = categoryImages.nth(i);
        await image.evaluate(element => element.decode());
        assert.ok(await image.evaluate(element => element.complete && element.naturalWidth > 0), 'category image ' + i + ' should load');
      }

      const search = page.getByRole('searchbox', { name: 'جستجو در دسته‌بندی و زیرگروه‌ها' });
      await search.fill('تایمینگ');
      assert.ok(new URL(page.url()).searchParams.get('q') === 'تایمینگ', 'search should be shareable in the URL');
      assert.equal(await page.locator('.all-categories-card').count(), 1, 'search should narrow to the matching category');
      assert.equal(await page.locator('.all-categories-group').count(), 1, 'empty groups should be removed from filtered results');

      const categoryHref = await page.getByRole('heading', { name: 'تسمه تایمینگ' }).locator('a').getAttribute('href');
      assert.equal(categoryHref, '/category/excel-v2-1-1', 'category title should use the canonical Excel taxonomy route');

      await page.getByRole('button', { name: 'پاک کردن جستجو' }).click();
      assert.equal(new URL(page.url()).searchParams.has('q'), false, 'clearing search should remove q from the URL');
      assert.equal(await page.locator('.all-categories-card').count(), 3, 'clearing search should restore all categories');

      const subcategoryLink = page.locator('.all-categories-subcategory-links a').filter({ hasText: 'سیم‌دار فابریک' }).first();
      assert.ok((await subcategoryLink.getAttribute('href')).includes('sub='), 'subcategory quick links should preserve the selected taxonomy value');

      await page.locator('.all-categories-group-nav a').filter({ hasText: 'نوارهای نقاله و انتقال مواد' }).click();
      assert.ok(page.url().includes('#menu-group-excel-v2-2'), 'group jump navigation should preserve the established deep-link anchor');

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));

      if (pageErrors.length) failures.push({ viewport, pageErrors });
      await page.screenshot({
        path: '/tmp/all-categories-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      console.log('ALL_CATEGORIES_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(layout));
      await context.close();
    }

    const fallbackContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'fa-IR',
      reducedMotion: 'reduce',
    });
    const fallbackPage = await fallbackContext.newPage();
    await installApiRoutes(fallbackPage, true);
    await fallbackPage.goto(baseUrl + '/categories', { waitUntil: 'domcontentloaded' });
    await fallbackPage.locator('.all-categories-page').waitFor();
    await fallbackPage.getByText('نمایش راهنمای دسته‌بندی؛ آمار زنده در دسترس نیست').waitFor({ timeout: 15000 });
    assert.ok(await fallbackPage.locator('.all-categories-fallback-note').isVisible(), 'fallback taxonomy should be explicitly labelled');
    assert.equal(await fallbackPage.locator('.all-categories-stat-value').first().innerText(), '—', 'fallback group count must not be presented as live');
    assert.ok(await fallbackPage.locator('.all-categories-card-meta-muted').count() > 0, 'fallback must not display stale family/SKU counts');
    await fallbackContext.close();

    assert.deepEqual(failures, [], 'browser page errors were detected');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
