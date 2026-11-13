'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.EXCEL_CATEGORY_PREVIEW_URL || 'http://127.0.0.1:4173';
const slug = 'excel-v2-1-1';
const category = {
  slug,
  name: 'تسمه تایمینگ صنعتی',
  description: 'تسمه‌های دندانه‌دار برای انتقال حرکت هماهنگ در خطوط تولید.',
  image: null,
  children: [
    { name: 'سیم‌دار فابریک', children: [{ name: 'پلی‌یورتان' }, { name: 'کامیون‌دار کلیددار' }] },
    { name: 'لاستیکی فابریک', children: [{ name: 'لاستیکی' }] },
  ],
};
const families = [
  {
    code: 'TEST-BELT-001',
    name: 'خانواده تسمه تایمینگ آزمایشی 6205',
    brand: 'Test Brand',
    submenu: 'سیم‌دار فابریک',
    leaf: 'پلی‌یورتان',
    skuCount: 3,
  },
  {
    code: 'TEST-BELT-002',
    name: 'خانواده تسمه تایمینگ لاستیکی',
    brand: 'Test Brand',
    submenu: 'لاستیکی فابریک',
    leaf: 'لاستیکی',
    skuCount: 2,
  },
  {
    code: 'TEST-BELT-003',
    name: 'خانواده تسمه تایمینگ بدون تصویر',
    brand: 'Other Brand',
    submenu: 'سیم‌دار فابریک',
    leaf: 'کامیون‌دار کلیددار',
    skuCount: 1,
  },
  ...Array.from({ length: 24 }, (_, index) => ({
    code: 'TEST-BELT-' + String(index + 4).padStart(3, '0'),
    name: 'خانواده آزمایشی تسمه ' + (index + 4),
    brand: 'Other Brand',
    submenu: 'سیم‌دار فابریک',
    leaf: 'کامیون‌دار کلیددار',
    skuCount: 1,
  })),
];
const products = [
  {
    code: 'TEST-BELT-001',
    name: 'تسمه تایمینگ آزمایشی 6205',
    nameEn: 'Test Timing Belt 6205',
    brand: 'Test Brand',
    categorySlug: slug,
    categoryName: category.name,
    submenu: 'سیم‌دار فابریک',
    subcategory: 'پلی‌یورتان',
    technicalSpecs: [
      { key: 'گام دندانه', value: '5 mm' },
      { key: 'عرض تسمه', value: '10 mm' },
    ],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 5,
    stockKnown: true,
    inquiryOnly: false,
    variants: [
      {
        code: '6205-2RS',
        name: 'کد آزمایشی 6205',
        size: '10 × 500 mm',
        model: '6205-2RS',
        brand: 'Test Brand',
        unit: 'عدد',
        price: 0,
        prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
        stock: 5,
        stockKnown: true,
        inquiryOnly: false,
        technicalSpecs: [{ key: 'عرض', value: '10 mm' }],
        images: ['/storage/products/catalog/e(1).png'],
        active: true,
      },
    ],
    images: ['/storage/products/catalog/e(1).png'],
    tags: ['آزمایش'],
    unit: 'عدد',
    active: true,
    hasCatalogueImage: true,
  },
  {
    code: 'TEST-BELT-003',
    name: 'تسمه تایمینگ آزمایشی بدون تصویر',
    nameEn: 'Test Timing Belt without image',
    brand: 'Other Brand',
    categorySlug: slug,
    categoryName: category.name,
    submenu: 'سیم‌دار فابریک',
    subcategory: 'کامیون‌دار کلیددار',
    technicalSpecs: [{ key: 'عرض', value: '15 mm' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    variants: [],
    images: [],
    tags: ['آزمایش'],
    unit: 'عدد',
    active: true,
    hasCatalogueImage: false,
  },
];
const runtimeFixture = {
  success: true,
  database: true,
  userId: null,
  values: {},
  versions: {},
  productsIncluded: true,
  products,
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

async function installApiRoutes(page, initiallyUnavailable = false) {
  let menuUnavailable = initiallyUnavailable;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/catalog/menu-category/')) {
      if (menuUnavailable) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, category, families }),
      });
    }
    if (url.pathname === '/api/catalog/direct-skus') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, items: [] }),
      });
    }
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
  return { setMenuUnavailable: value => { menuUnavailable = value; } };
}

// Observe the committed React render, not the intermediate DOM immediately after a click.
async function expectProductCount(page, count, message) {
  await page.waitForFunction(
    expected => document.querySelectorAll('.excel-category-product-shell').length === expected,
    count, { timeout: 10000 },
  );
  assert.equal(await page.locator('.excel-category-product-shell').count(), count, message);
}

async function selectFilterChoice(page, containerSelector, label, queryKey, queryValue = '1') {
  const choice = page.locator(containerSelector + ' label').filter({ hasText: label }).first();
  await choice.locator('span').click();
  await page.waitForURL(url => queryKey === 'brand'
    ? url.searchParams.getAll(queryKey).includes(queryValue)
    : url.searchParams.get(queryKey) === queryValue, { timeout: 10000 });
  await page.waitForFunction(({ selector, text }) => {
    const labelElement = Array.from(document.querySelectorAll(selector + ' label'))
      .find(element => element.textContent?.includes(text));
    const input = labelElement?.querySelector('input[type="checkbox"]');
    return input instanceof HTMLInputElement && input.checked;
  }, { selector: containerSelector, text: label }, { timeout: 10000 });
}

async function applyMobileFilter(page, label, queryKey, queryValue = '1') {
  await page.locator('.excel-category-mobile-filter').click();
  const sheet = page.getByRole('dialog', { name: 'فیلترهای دسته‌بندی' });
  await sheet.waitFor({ state: 'visible' });
  await selectFilterChoice(page, '.excel-category-filter-sheet', label, queryKey, queryValue);
  await sheet.locator('footer button').last().click();
  await sheet.waitFor({ state: 'hidden' });
}

async function clearMobileFilters(page) {
  await page.locator('.excel-category-mobile-filter').click();
  const sheet = page.getByRole('dialog', { name: 'فیلترهای دسته‌بندی' });
  await sheet.waitFor({ state: 'visible' });
  await sheet.locator('footer button').first().click();
  await sheet.waitFor({ state: 'hidden' });
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
      await page.goto(baseUrl + '/category/' + slug, { waitUntil: 'domcontentloaded' });
      await page.locator('.excel-category-page').waitFor();
      await page.getByRole('heading', { name: category.name }).waitFor({ timeout: 25000 });
      await page.locator('.excel-category-product-shell .excel-card').first().waitFor({ timeout: 25000 });

      await expectProductCount(page, 24, 'first page should contain 24 database-backed families');
      assert.ok(await page.locator('.excel-category-pagination').isVisible(), 'pagination should appear when more than one page exists');
      assert.ok(await page.locator('.excel-category-subnav-group').count() === 2, 'approved nested subcategories should render');

      const heroImage = page.locator('.excel-category-hero-visual img');
      await heroImage.waitFor({ state: 'visible' });
      await heroImage.evaluate(image => image.decode());
      assert.ok(await heroImage.evaluate(image => image.complete && image.naturalWidth > 0), 'category hero image should load');

      const featuredImage = page.locator('.excel-category-featured-image img');
      if (viewport.width > 1180) {
        await featuredImage.waitFor({ state: 'visible' });
        await featuredImage.evaluate(image => image.decode());
        assert.ok(await featuredImage.evaluate(image => image.complete && image.naturalWidth > 0), 'real catalogue family image should load in the featured panel');
      }

      const leaf = page.locator('.excel-category-subnav-leaves button').filter({ hasText: 'پلی‌یورتان' }).first();
      await leaf.click();
      await page.waitForURL(url => url.searchParams.get('sub') === 'پلی‌یورتان', { timeout: 10000 });
      await expectProductCount(page, 1, 'leaf selection should filter to the matching family');

      await page.getByRole('button', { name: /همه خانواده‌ها/ }).click();
      await page.waitForURL(url => !url.searchParams.has('sub'), { timeout: 10000 });
      await expectProductCount(page, 24, 'clearing subcategory should restore all families');

      const search = page.getByRole('searchbox', { name: 'جستجو در خانواده‌ها و مشخصات فنی' });
      await search.fill('6205');
      await page.waitForURL(url => url.searchParams.get('q') === '6205', { timeout: 10000 });
      await expectProductCount(page, 1, 'search should match an actual variant code');
      await page.getByRole('button', { name: 'پاک کردن جستجو' }).click();
      await page.waitForURL(url => !url.searchParams.has('q'), { timeout: 10000 });
      await expectProductCount(page, 24, 'clearing search should restore all families and pagination');
      await page.locator('.excel-category-pagination').waitFor({ state: 'visible' });
      const nextPageButton = page.getByRole('button', { name: 'بعدی' });
      await nextPageButton.waitFor({ state: 'visible' });
      assert.equal(await nextPageButton.isEnabled(), true, 'next page should be available after clearing search');
      await nextPageButton.click();
      await page.waitForURL(url => url.searchParams.get('page') === '2', { timeout: 10000 });
      await expectProductCount(page, 3, 'second page should show the remaining three families');
      const previousPageButton = page.getByRole('button', { name: 'قبلی' });
      await previousPageButton.waitFor({ state: 'visible' });
      assert.equal(await previousPageButton.isEnabled(), true, 'previous page should be available on page two');
      await previousPageButton.click();
      await page.waitForURL(url => url.searchParams.get('page') === '1' || !url.searchParams.has('page'), { timeout: 10000 });
      await expectProductCount(page, 24, 'previous page should restore the first result page');

      if (viewport.width <= 900) {
        await page.locator('.excel-category-mobile-filter').click();
        const sheet = page.getByRole('dialog', { name: 'فیلترهای دسته‌بندی' });
        await sheet.waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden', 'mobile filters should lock background scrolling');
        await page.keyboard.press('Shift+Tab');
        assert.ok(await sheet.evaluate(element => element.contains(document.activeElement)), 'keyboard focus should remain inside the filter dialog');
        await page.keyboard.press('Escape');
        await sheet.waitFor({ state: 'hidden' });
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'closing filters should restore page scrolling');
        await applyMobileFilter(page, 'Test Brand', 'brand', 'Test Brand');
      } else {
        await selectFilterChoice(page, '.excel-category-filter-panel', 'Test Brand', 'brand', 'Test Brand');
      }
      await expectProductCount(page, 2, 'brand filter should return the two matching families');
      await page.waitForURL(url => url.searchParams.getAll('brand').includes('Test Brand'), { timeout: 10000 });

      if (viewport.width <= 900) await clearMobileFilters(page);
      else await page.locator('.excel-category-filter-heading button').click();
      await expectProductCount(page, 24, 'clearing brand filter should restore the first page');

      if (viewport.width <= 900) await applyMobileFilter(page, 'فقط دارای موجودی تأییدشده', 'stock');
      else await selectFilterChoice(page, '.excel-category-filter-panel', 'فقط دارای موجودی تأییدشده', 'stock');
      await expectProductCount(page, 1, 'confirmed-stock filter must exclude unknown and inquiry-only families');
      await page.waitForURL(url => url.searchParams.get('stock') === '1', { timeout: 10000 });

      if (viewport.width <= 900) await clearMobileFilters(page);
      else await page.locator('.excel-category-filter-heading button').click();

      if (viewport.width <= 900) await applyMobileFilter(page, 'فقط دارای تصویر ثبت‌شده', 'image');
      else await selectFilterChoice(page, '.excel-category-filter-panel', 'فقط دارای تصویر ثبت‌شده', 'image');
      await expectProductCount(page, 1, 'image filter should return only families with a registered image');
      await page.waitForURL(url => url.searchParams.get('image') === '1', { timeout: 10000 });

      if (viewport.width <= 900) await clearMobileFilters(page);
      else await page.locator('.excel-category-filter-heading button').click();

      await page.locator('.excel-category-product-shell .excel-category-compare-toggle').nth(0).click();
      await page.locator('.excel-category-product-shell .excel-category-compare-toggle').nth(1).click();
      const compareDock = page.locator('.excel-category-compare-dock');
      await compareDock.waitFor({ state: 'visible' });
      await compareDock.locator('.excel-category-compare-open').click();
      const compareDialog = page.getByRole('dialog', { name: 'مقایسه خانواده‌های انتخاب‌شده' });
      await compareDialog.waitFor({ state: 'visible' });
      assert.ok(await compareDialog.locator('table').isVisible(), 'technical comparison table should render');
      assert.ok((await compareDialog.innerText()).includes('گام دندانه'), 'comparison should include real family technical specs');
      await page.keyboard.press('Escape');
      await compareDialog.waitFor({ state: 'hidden' });

      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(layout.document <= layout.viewport + 1, 'unexpected horizontal document overflow: ' + JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 1, 'unexpected horizontal body overflow: ' + JSON.stringify(layout));
      if (pageErrors.length) failures.push({ viewport, pageErrors });

      await page.screenshot({
        path: '/tmp/excel-category-' + viewport.width + 'x' + viewport.height + '.png',
        fullPage: false,
        animations: 'disabled',
      });
      console.log('EXCEL_CATEGORY_RESPONSIVE_OK', viewport.width + 'x' + viewport.height, JSON.stringify(layout));
      await context.close();
    }

    const errorContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fa-IR', reducedMotion: 'reduce' });
    const errorPage = await errorContext.newPage();
    const errorApi = await installApiRoutes(errorPage, true);
    await errorPage.goto(baseUrl + '/category/' + slug, { waitUntil: 'domcontentloaded' });
    await errorPage.locator('.excel-category-page').waitFor();
    await errorPage.getByText('اطلاعات این دسته دریافت نشد').waitFor({ timeout: 15000 });
    assert.ok(await errorPage.getByRole('button', { name: 'تلاش مجدد' }).isVisible(), 'database failure should expose a retry action');
    await expectProductCount(errorPage, 0, 'database failure must not render stale family data');
    errorApi.setMenuUnavailable(false);
    await errorPage.getByRole('button', { name: 'تلاش مجدد' }).click();
    await errorPage.getByRole('heading', { name: category.name }).waitFor({ timeout: 15000 });
    await expectProductCount(errorPage, 24, 'retry should recover the live family list');
    await errorContext.close();

    assert.deepEqual(failures, [], 'browser page errors were detected');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
