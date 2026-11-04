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
      assert.equal(await page.locator(".consumer-overview-extra .portal-club").count(),0,
        "collapsed overview reports must not render the club until requested");
      await page.screenshot({ path: `${out}/consumer-portal-${width}.png`, fullPage: true });

      const scroll = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      if (scroll.page > scroll.viewport + 3) {
        const offenders = await page.evaluate(() =>
          [...document.querySelectorAll("body *")].map(el => {
            const b = el.getBoundingClientRect();
            return { tag: el.tagName, className: typeof el.className === "string" ? el.className.slice(0, 110) : "",
              left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) };
          }).filter(b => b.left < -3 || b.right > document.documentElement.clientWidth + 3)
            .slice(0, 25));
        console.error("OVERFLOW DIAGNOSTICS", width, JSON.stringify(offenders));
      }
      assert.ok(scroll.page <= scroll.viewport + 3,
        `horizontal overflow at ${width}px: ${JSON.stringify(scroll)}`);

      const bottomNav = page.locator(".consumer-premium .portal-mobile-nav");
      const sidebar = page.locator(".consumer-premium .portal-sidebar");
      if (width < 1024) {
        assert.equal(await bottomNav.locator("button").count(), 5, "consumer bottom navigation must have five actions");
        assert.ok(await bottomNav.isVisible(), "mobile navigation should be visible");
        assert.ok(!(await sidebar.isVisible()), "desktop sidebar should be hidden on mobile");
        await bottomNav.locator("button").nth(1).click();
        await page.getByRole("heading", { name: "سفارش‌ها و رهگیری مرسوله" }).waitFor();
        const orderSummary = await page.locator(".consumer-summary-duo > div").evaluateAll(cards =>
          cards.map(card => {
            const b = card.getBoundingClientRect();
            return { left: b.left, right: b.right, width: b.width };
          }));
        assert.equal(orderSummary.length, 2, "retail order overview needs two summary tiles");
        for (const card of orderSummary) {
          assert.ok(card.left >= -3 && card.right <= width + 3,
            "order summary clipped outside mobile viewport: " + JSON.stringify({width, card}));
        }

        await bottomNav.locator("button").last().click();
        await page.locator("dialog[open]").waitFor();
        await page.locator("dialog[open]").getByRole("button", { name: /آدرس‌ها و اطلاعات تحویل/ }).click();
        await page.getByRole("heading", { name: "آدرس‌ها و اطلاعات تحویل" }).waitFor();
      } else {
        assert.ok(await sidebar.isVisible(), "desktop must show its section sidebar");
        assert.ok(!(await bottomNav.isVisible()), "desktop should not show the mobile dock");
      }
      if (width === 390 || width === 1440) {
        const screens = [
          { id: "orders", label: "سفارشات و رهگیری مرسوله", title: "سفارش‌ها و رهگیری مرسوله" },
          { id: "quick_buy", label: "ثبت سفارش سریع", title: "خرید سریع قطعات" },
          { id: "club_rewards", label: "باشگاه مشتریان", title: "باشگاه مشتریان" },
          { id: "saved_products", label: "محصولات نشان‌شده", title: "محصولات نشان‌شده" },
          { id: "purchase_list", label: "لیست خرید چندکدی", title: "لیست خرید چندکدی" },
          { id: "receipts", label: "فاکتورها و رسیدها", title: "فاکتورها و رسیدها" },
          { id: "addresses", label: "آدرس‌ها و اطلاعات تحویل", title: "آدرس‌ها و اطلاعات تحویل" },
        ];
        for (const screen of screens) {
          if (width < 1024) {
            await bottomNav.locator("button").last().click();
            await page.locator("dialog[open]").getByRole("button", { name: screen.label, exact: false }).click();
          } else {
            await sidebar.getByRole("button", { name: screen.label, exact: false }).click();
          }
          await page.locator(".portal-heading h1").waitFor();
          const panelSelectors = {
            orders: ".consumer-orders-section", quick_buy: ".consumer-quickbuy-panel",
            club_rewards: ".consumer-club-page", saved_products: ".consumer-saved-reference",
            purchase_list: ".consumer-multicode-panel", receipts: ".consumer-invoices-panel",
            addresses: ".consumer-address-panel",
          };
          // The four secondary portal panels are lazy-loaded, so wait for their real UI.
          await page.locator(panelSelectors[screen.id]).waitFor({ timeout: 30000 });
          const title = await page.locator(".portal-heading h1").textContent();
          assert.equal(title?.trim(), screen.title, `incorrect page title for ${screen.id}`);
          const bounds = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            page: document.documentElement.scrollWidth,
          }));
          assert.ok(bounds.page <= bounds.viewport + 3,
            `horizontal overflow at ${width}px in ${screen.id}: ${JSON.stringify(bounds)}`);
          await page.screenshot({ path: `${out}/consumer-portal-${width}-${screen.id}.png`, fullPage: true });
          if (screen.id === "quick_buy") {
            const input = page.locator(".consumer-search-field input");
            await input.fill("UNIT-DOES-NOT-EXIST-999999");
            await page.locator(".consumer-quickbuy-panel[aria-busy='false']").waitFor();
            await page.getByText("کالایی با این جستجو پیدا نشد").waitFor();
            await input.fill("");
            await page.locator(".consumer-quickbuy-panel[aria-busy='false']").waitFor();
          }
          if (screen.id === "purchase_list") {
            await page.locator("#portal-bulk-input").fill("UNIT-NONEXISTENT-999, 2");
            await page.getByRole("button", {name: /بررسی لیست خرید/}).click();
            await page.locator(".consumer-bulk-results").waitFor();
          }
          console.log(`PASS consumer page ${screen.id} at ${width}px`);
        }
        await page.getByRole("button", { name: /افزودن آدرس جدید/ }).click();
        await page.getByRole("heading", { name: "ثبت آدرس جدید" }).waitFor();
        await page.locator(".consumer-address-fields input").first().fill("آدرس آزمایشی");
      }
      console.log(`PASS consumer portal ${width}px, no horizontal overflow; screenshot saved`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
