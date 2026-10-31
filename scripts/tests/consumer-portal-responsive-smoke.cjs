/* Responsive visual smoke uses a synthetic retail session, never production customer data. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const out = process.env.SCREENSHOT_DIR || "/tmp";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const customer = {
  id: "ui-smoke-retail",
  fullName: "مشتری نمونه",
  firstName: "مشتری",
  lastName: "نمونه",
  companyName: "حساب آزمایشی",
  username: "sample-ui-test",
  phone: "09000000000",
  role: "retail",
  approvedB2B: false,
  onboardingCompleted: true,
  addresses: [],
  totalPurchases: 0,
  totalOrdersAmount: 0,
};

(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [360, 390, 768, 1280, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: width < 768 ? 800 : 960 },
        reducedMotion: "reduce",
        locale: "fa-IR",
      });
      await page.route("**/api/portal", async route => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, user: customer, admin: false, revision: 1, values: {} }),
        });
      });
      await page.goto(base + "/consumer-dashboard", { waitUntil: "domcontentloaded" });
      await page.locator(".customer-portal.consumer-premium").waitFor({ timeout: 30000 });
      await page.locator(".consumer-shortcuts").waitFor();
      await page.screenshot({ path: `${out}/consumer-portal-${width}.png`, fullPage: true });

      const scroll = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(scroll.page <= scroll.viewport + 3,
        `horizontal overflow at ${width}px: ${JSON.stringify(scroll)}`);

      const bottomNav = page.locator(".consumer-premium .portal-mobile-nav");
      const sidebar = page.locator(".consumer-premium .portal-sidebar");
      if (width < 768) {
        assert.equal(await bottomNav.locator("button").count(), 5, "consumer bottom navigation must have five actions");
        assert.ok(await bottomNav.isVisible(), "mobile navigation should be visible");
        assert.ok(!(await sidebar.isVisible()), "desktop sidebar should be hidden on mobile");
        await bottomNav.locator("button").nth(1).click();
        await page.getByRole("heading", { name: "سفارش‌ها و رهگیری مرسوله" }).waitFor();
        await bottomNav.locator("button").last().click();
        await page.locator("dialog[open]").waitFor();
        await page.locator("dialog[open]").getByRole("button", { name: /آدرس‌ها و اطلاعات تحویل/ }).click();
        await page.getByRole("heading", { name: "آدرس‌ها و اطلاعات تحویل" }).waitFor();
      } else {
        assert.ok(await sidebar.isVisible(), "desktop must show its section sidebar");
        assert.ok(!(await bottomNav.isVisible()), "desktop should not show the mobile dock");
      }
      console.log(`PASS consumer portal ${width}px, no horizontal overflow; screenshot saved`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
