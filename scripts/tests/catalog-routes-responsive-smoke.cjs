/* Direct-route and responsive smoke tests for the real catalogue route family. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");

const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const out = process.env.SCREENSHOT_DIR || "/tmp";
const categorySlug = "test-bearing-category";
const categoryName = "بلبرینگ و یاتاقان";
const categories = [{
  id: 91001,
  name: categoryName,
  slug: categorySlug,
  nameEn: "Bearings",
  icon: "Package",
  description: "آزمون مستقیم مسیر دسته‌بندی با داده ساختاری معتبر",
  image: "",
  children: [{ name: "بلبرینگ شیار عمیق", children: [] }],
  subcategories: ["بلبرینگ شیار عمیق"],
  count: 0,
  familyCount: 0,
  skuCount: 0,
  active: true,
}];

// Isolated UI fixture only: never reaches production data or the live database.
const testPrices = { base: 0, retail: 0, wholesale: 0, dealer: 0 };
const products = [
  {
    code: "TEST-FAMILY-A",
    name: "قطعه آزمایشی A",
    brand: "برند آزمایشی A",
    categorySlug,
    categoryName,
    submenu: "بلبرینگ",
    subcategory: "بلبرینگ شیار عمیق",
    technicalSpecs: [{ key: "قطر داخلی", value: "۲۰ میلی‌متر" }, { key: "قطر خارجی", value: "۴۷ میلی‌متر" }],
    prices: testPrices,
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    images: [],
    tags: [],
    unit: "عدد",
    featured: true,
    description: "رکورد آزمایشی برای آزمون چیدمان و تعامل صفحه",
    active: true,
    variants: [{
      code: "TEST-SKU-A1",
      size: "۲۰ × ۴۷ × ۱۴ میلی‌متر",
      name: "قطعه آزمایشی A — سایز اول",
      brand: "برند آزمایشی A",
      price: 0,
      prices: testPrices,
      inquiryOnly: true,
      stock: 0,
      stockKnown: false,
      technicalSpecs: [{ key: "قطر داخلی", value: "۲۰ میلی‌متر" }],
      images: [],
      active: true,
    }],
  },
  {
    code: "TEST-FAMILY-B",
    name: "قطعه آزمایشی B",
    brand: "برند آزمایشی B",
    categorySlug,
    categoryName,
    submenu: "بلبرینگ",
    subcategory: "بلبرینگ شیار عمیق",
    technicalSpecs: [{ key: "قطر داخلی", value: "۲۵ میلی‌متر" }, { key: "قطر خارجی", value: "۵۲ میلی‌متر" }],
    prices: testPrices,
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    images: [],
    tags: [],
    unit: "عدد",
    featured: false,
    description: "رکورد آزمایشی دوم برای آزمون فهرست محصولات",
    active: true,
    variants: [],
  },
];

(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    for (const width of [360, 390, 768, 1280, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: width < 768 ? 844 : 960 },
        deviceScaleFactor: 1,
        isMobile: width < 768,
        hasTouch: width < 768,
        locale: "fa-IR",
        timezoneId: "Asia/Tehran",
        reducedMotion: "reduce",
      });
      const pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));

      await page.route("**/api/portal*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, user: null, admin: false, revision: 1, values: {} }),
      }));
      await page.route("**/api/runtime*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          database: true,
          userId: null,
          values: {
            atlas_admin_categories_v1: categories,
            atlas_admin_brands_v1: [],
          },
          versions: {},
          products,
          productsIncluded: true,
        }),
      }));
      await page.route("**/api/catalog/direct-skus*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, items: [] }),
      }));
      await page.route("**/api/catalog/categories*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, categories }),
      }));
      await page.route("**/api/catalog/navigation-groups*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, groups: [] }),
      }));

      // The direct URL must render after database hydration without a category[0] crash.
      await page.goto(base + "/category/" + encodeURIComponent(categorySlug), { waitUntil: "domcontentloaded" });
      await page.locator(".category-showcase-intro").waitFor({ timeout: 30000 });
      await page.getByRole("heading", { name: categoryName }).first().waitFor();
      const categoryBounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(categoryBounds.page <= categoryBounds.viewport + 3,
        "horizontal overflow on category route at " + width + "px: " + JSON.stringify(categoryBounds));
      await page.screenshot({
        path: `${out}/catalog-category-${width}.png`,
        fullPage: false,
        animations: "disabled",
      });

      // The featured family and a second real catalogue record can be selected and compared.
      await page.locator(".category-featured-panel__compare").click();
      await page.locator(".store-product-compare-toggle").first().click();
      await page.locator(".category-comparison-dock").waitFor({ timeout: 10000 });
      assert.equal(await page.locator(".category-comparison-dock__items button").count(), 2,
        "comparison dock must contain both selected catalogue products");
      await page.locator(".category-comparison-dock__actions button:first-child").click();
      await page.getByRole("dialog").waitFor({ timeout: 10000 });
      assert.ok(await page.locator(".category-comparison-table-wrap tbody tr").count() >= 5,
        "technical comparison must include the actual catalogue attributes");
      assert.equal(await page.locator(".category-comparison-table-wrap tbody th").getByText(/قیمت/).count(), 0,
        "customer-specific prices must not be included in the comparison");
      await page.getByRole("button", { name: "بستن مقایسه" }).first().click();
      await page.locator(".category-comparison-dialog").waitFor({ state: "hidden" });

      // Product detail is hydrated from the same test catalogue and keeps guest pricing private.
      await page.goto(base + "/product/TEST-FAMILY-A", { waitUntil: "domcontentloaded" });
      await page.locator(".product-detail-main").waitFor({ timeout: 20000 });
      await page.getByRole("heading", { name: "قطعه آزمایشی A — سایز اول" }).waitFor({ timeout: 20000 });
      const detailBounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(detailBounds.page <= detailBounds.viewport + 3,
        "horizontal overflow on product detail at " + width + "px: " + JSON.stringify(detailBounds));
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: `${out}/catalog-product-detail-${width}.png`,
          fullPage: false,
          animations: "disabled",
        });
      }
      assert.equal(await page.locator(".product-detail-info").getByText(/تومان/).count(), 0,
        "guest product detail must not expose commercial prices");

      // Invalid category slugs must render the same useful 404, not a broken empty category.
      await page.goto(base + "/category/not-a-real-category", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "این مسیر به قطعه موردنظر نمی‌رسد." }).waitFor({ timeout: 20000 });

      // The old /catalog entry point must lead to the actual product catalogue.
      await page.goto(base + "/catalog", { waitUntil: "domcontentloaded" });
      await page.waitForURL(url => url.pathname === "/products", { timeout: 20000 });
      await page.getByRole("heading", { name: "محصولات و قطعات صنعتی" }).waitFor();

      // Unknown product and direct-SKU paths should remain safe and navigable.
      await page.goto(base + "/product/UNKNOWN-CATALOG-CODE", { waitUntil: "domcontentloaded" });
      await page.locator("body").waitFor({ state: "visible" });
      await page.goto(base + "/direct-product/UNKNOWN-DIRECT-SKU", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "این مسیر به قطعه موردنظر نمی‌رسد." }).waitFor({ timeout: 15000 });

      assert.deepEqual(pageErrors, [], "browser page errors at " + width + "px");
      console.log("PASS catalogue direct routes at " + width + "px");
      await page.close();
    }

    const dealer = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "fa-IR" });
    await dealer.route("**/api/portal*", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, user: null, admin: false, revision: 1, values: {} }),
    }));
    await dealer.route("**/api/runtime*", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, database: true, userId: null, values: {}, versions: {}, products: [], productsIncluded: true }),
    }));
    await dealer.goto(base + "/dealer?tab=orders#billing", { waitUntil: "domcontentloaded" });
    await dealer.waitForURL(url => url.pathname === "/login", { timeout: 20000 });
    const returnTo = new URL(dealer.url()).searchParams.get("returnTo");
    assert.equal(returnTo, "/account?tab=orders", "legacy dealer route must preserve its tab query for the protected factory portal");
    console.log("PASS legacy dealer route resolves through protected industrial account");

    const missing = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "fa-IR" });
    await missing.goto(base + "/definitely-not-a-real-route", { waitUntil: "domcontentloaded" });
    await missing.getByRole("heading", { name: "این مسیر به قطعه موردنظر نمی‌رسد." }).waitFor({ timeout: 20000 });
    console.log("PASS unknown route renders the useful 404 page");
    await browser.close();
  } catch (error) {
    await browser.close();
    throw error;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
