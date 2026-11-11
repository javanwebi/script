/* Desktop/mobile visual smoke for the company pages linked from About navigation. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const out = process.env.SCREENSHOT_DIR || "/tmp";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173";

const pages = [
  { path: "/about", selector: ".sp-about-page .sp-about-hero", heading: /بازار تخصصی/ },
  { path: "/services", selector: ".company-page--services", heading: /از شناخت قطعه تا/ },
  { path: "/industries", selector: ".company-page--industries", heading: /هر صنعت، نیاز فنی خودش را دارد/ },
  { path: "/industries/textile", selector: ".textile-page .textile-hero", heading: /نساجی/ },
  { path: "/brands", selector: ".company-page--brands", heading: /برند را بشناسید/ },
  { path: "/knowledge", selector: ".knowledge-intro", heading: /شناخت بهتر قطعه/ },
  { path: "/contact", selector: "#contact-workspace-main", heading: /تماس با/ },
];

(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 768, 1280, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: width < 768 ? 844 : 960 },
        reducedMotion: "reduce",
        locale: "fa-IR",
      });
      await page.route("**/api/portal*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, user: null, admin: false, revision: 1, values: {} }),
      }));
      await page.route("**/api/runtime*", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, database: true, admin: false, userId: null, productsIncluded: true, products: [], values: {}, versions: {} }),
      }));

      // The homepage preview must lead to the actual About page, not an unused legacy component.
      await page.goto(base + "/", { waitUntil: "domcontentloaded" });
      await page.locator(".home-about-preview").waitFor({ timeout: 30000 });
      const aboutLink = page.locator('.home-about-preview a[href="/about"]').first();
      await aboutLink.waitFor({ state: "visible" });
      await aboutLink.click();
      await page.locator(".sp-about-page .sp-about-hero").waitFor({ timeout: 15000 });
      await page.getByRole("heading", { level: 1 }).first().waitFor();

      const requiredAboutLinks = ["/services", "/industries", "/brands", "/knowledge", "/contact"];
      for (const href of requiredAboutLinks) {
        assert.ok(await page.locator(`.sp-about-page a[href="${href}"]`).count() > 0,
          `About page is missing its ${href} navigation link`);
      }
      assert.equal(await page.locator(".sp-about-capability").count(), 4,
        "approved About page must show its four visual capabilities");
      const timelineYears = await page.locator(".sp-about-timeline__label").allTextContents();
      assert.deepEqual(timelineYears.map(value => value.trim()), ["پشتوانه", "شناخت", "توسعه", "امروز"],
        "approved About page must show the four Atlas-to-Sanat Pish milestones");
      assert.equal(await page.locator(".sp-about-destination").count(), 5,
        "approved About page must link to its five next destinations");
      const aboutBounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(aboutBounds.page <= aboutBounds.viewport + 3,
        `horizontal overflow on About at ${width}px: ${JSON.stringify(aboutBounds)}`);
      const heroImageLoaded = await page.locator(".sp-about-hero__visual img").evaluate(
        image => image.complete && image.naturalWidth > 0
      );
      assert.ok(heroImageLoaded, "About hero industrial image did not load");
      await page.screenshot({ path: `${out}/company-pages-${width}-about.png`, fullPage: true });

      for (const item of pages.slice(1)) {
        await page.goto(base + item.path, { waitUntil: "domcontentloaded" });
        await page.locator(item.selector).waitFor({ timeout: 20000 });
        const heading = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
        if (item.path === "/industries/textile") {
          const textileHeroImage = page.locator(".textile-hero-image");
          await textileHeroImage.waitFor({ state: "attached" });
          const heroImageLoaded = await textileHeroImage.evaluate(image =>
            image.complete && image.naturalWidth > 0
          );
          assert.ok(heroImageLoaded, "Textile hero industrial image did not load");
          const stages = page.locator(".textile-stage-list button");
          assert.equal(await stages.count(), 5, "Textile page must expose all five production stages");
          await stages.nth(1).click();
          assert.equal(await stages.nth(1).getAttribute("aria-pressed"), "true",
            "Textile production stage selection did not update");
          assert.equal((await page.locator("#textile-stage-panel h3").innerText()).trim(), "بافندگی",
            "Textile stage details did not update after selection");
        }
        assert.match(heading, item.heading, `incorrect heading on ${item.path}: ${heading}`);
        const bounds = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          page: document.documentElement.scrollWidth,
        }));
        assert.ok(bounds.page <= bounds.viewport + 3,
          `horizontal overflow on ${item.path} at ${width}px: ${JSON.stringify(bounds)}`);
        await page.screenshot({
          path: `${out}/company-pages-${width}-${item.path.slice(1)}.png`,
          fullPage: true,
        });
        console.log(`PASS ${item.path} at ${width}px`);
      }

      const finalBounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(finalBounds.page <= finalBounds.viewport + 3,
        `horizontal overflow at ${width}px: ${JSON.stringify(finalBounds)}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
