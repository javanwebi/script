/* Browser smoke for the approved FORZA mobile launcher and standalone VISION entry. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");

const dir = process.env.SCREENSHOT_DIR || "/tmp";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173";

async function noHorizontalOverflow(page, width, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert.ok(
    metrics.documentWidth <= width + 2 && metrics.bodyWidth <= width + 2,
    label + " horizontal overflow: " + JSON.stringify(metrics),
  );
  return metrics;
}

async function captureWorkspace(page, label) {
  const toggle = page.locator('button[aria-controls="forza-workspace-catalog-drawer"]').first();
  await toggle.waitFor({ timeout: 15000 });
  await page.screenshot({
    path: dir + "/sanat-forza-workspace-" + label + ".png",
    fullPage: false,
  });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  const drawer = page.locator("#forza-workspace-catalog-drawer");
  await drawer.waitFor({ state: "visible", timeout: 10000 });
  await drawer.locator("#forza-workspace-product-search").waitFor({ state: "visible" });
  await page.screenshot({
    path: dir + "/sanat-forza-workspace-" + label + "-catalog.png",
    fullPage: false,
  });
  await drawer.getByRole("button", { name: "بستن جستجوی کاتالوگ" }).click();
  await drawer.waitFor({ state: "hidden" });
}

async function testMobileForzaSwipe(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "fa-IR",
    reducedMotion: "reduce",
  });
  try {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const launcher = page.getByRole("button", { name: "مشاوره و راه‌های ارتباطی FORZA" });
    await launcher.waitFor({ timeout: 30000 });
    await launcher.click();

    const sheet = page.getByTestId("forza-mobile-contact-sheet");
    await sheet.waitFor({ timeout: 10000 });
    await page.getByTestId("forza-swipe-instruction").waitFor();
    await page.screenshot({ path: dir + "/sanat-forza-mobile-contact-sheet.png", fullPage: false });
    assert.equal(await sheet.getAttribute("aria-modal"), "true");
    assert.ok(await sheet.locator(".sp-forza-contact__channel").count() >= 3);
    assert.match(await sheet.locator(".sp-forza-contact__phone").getAttribute("href"), /^tel:/);
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("sanat-forza-contact-open")), true);

    // Dispatch a real browser TouchEvent sequence through React's delegated handlers.
    await page.evaluate(() => {
      const target = document.querySelector('[data-testid="forza-swipe-instruction"]');
      if (!target || typeof Touch !== "function" || typeof TouchEvent !== "function") {
        throw new Error("Browser TouchEvent support is required for the swipe regression");
      }
      const makeTouch = clientY => new Touch({
        identifier: 71,
        target,
        clientX: 190,
        clientY,
        screenX: 190,
        screenY: clientY,
        pageX: 190,
        pageY: clientY,
      });
      const start = makeTouch(520);
      const move = makeTouch(430);
      target.dispatchEvent(new TouchEvent("touchstart", {
        bubbles: true, cancelable: true, touches: [start], targetTouches: [start], changedTouches: [start],
      }));
      target.dispatchEvent(new TouchEvent("touchmove", {
        bubbles: true, cancelable: true, touches: [move], targetTouches: [move], changedTouches: [move],
      }));
      target.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [move],
      }));
    });
    await page.waitForURL(url => url.pathname === "/ai-consult", { timeout: 15000 });
    assert.equal(await page.getByTestId("forza-mobile-contact-sheet").count(), 0);
    await captureWorkspace(page, "mobile-390");
    console.log("PASS FORZA mobile swipe enters the real workspace");
  } finally {
    await page.close();
  }
}

async function testDesktopLauncher(browser) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    locale: "fa-IR",
    reducedMotion: "reduce",
  });
  try {
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const launcher = page.getByRole("button", { name: "مشاوره و راه‌های ارتباطی FORZA" });
    await launcher.waitFor({ timeout: 30000 });
    await launcher.click();
    await page.waitForURL(url => url.pathname === "/ai-consult", { timeout: 15000 });
    assert.equal(await page.getByTestId("forza-mobile-contact-sheet").count(), 0);
    await captureWorkspace(page, "desktop-1280");
    console.log("PASS desktop FORZA launcher opens the workspace directly");
  } finally {
    await page.close();
  }
}

async function testVisionEntryResponsive(browser) {
  for (const width of [360, 390, 430, 768, 1280]) {
    const height = width >= 1024 ? 900 : width === 768 ? 1024 : 860;
    const page = await browser.newPage({
      viewport: { width, height },
      locale: "fa-IR",
      reducedMotion: "reduce",
    });
    try {
      await page.goto(base + "/identify-part", { waitUntil: "domcontentloaded" });
      const entry = page.getByTestId("forza-vision-entry");
      await entry.waitFor({ timeout: 30000 });
      await page.getByRole("button", { name: "شروع اسکن با دوربین" }).waitFor();
      await page.getByRole("button", { name: "انتخاب تصویر از دستگاه" }).waitFor();
      const metrics = await noHorizontalOverflow(page, width, "FORZA VISION " + width);
      const images = await entry.locator("img").evaluateAll(nodes =>
        nodes.map(img => ({
          src: img.getAttribute("src"),
          loaded: img.complete && img.naturalWidth > 0,
        })),
      );
      assert.ok(images.every(img => img.loaded), "FORZA VISION image failed to load at " + width + ": " + JSON.stringify(images));
      if (width === 390 || width === 1280) {
        await page.screenshot({
          path: dir + "/sanat-forza-vision-entry-" + width + ".png",
          fullPage: true,
        });
      }
      if (width === 390) {
        const fullScreenPage = page.locator('[role="main"][data-fullscreen="true"]');
        await fullScreenPage.waitFor({ state: "visible" });
        const scrollState = await page.evaluate(() => ({
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          bodyOverflowY: getComputedStyle(document.body).overflowY,
        }));
        assert.ok(
          scrollState.documentHeight > scrollState.viewportHeight,
          "Mobile KIKI VISION content must remain reachable by page scrolling",
        );
        // The standalone KIKI entry uses the document scroll rather than a nested legacy dialog scroller.
        const bottom = entry.locator("main").last();
        await bottom.evaluate(el => el.scrollIntoView({block: "end"}));
        const reached = await page.evaluate(() =>
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
        );
        assert.ok(reached, "Bottom of the mobile VISION page must be reachable by scrolling");
        await page.screenshot({
          path: dir + "/sanat-forza-vision-entry-390-bottom.png",
          fullPage: false,
        });
      }
      console.log("PASS FORZA VISION entry responsive", width, metrics);
    } finally {
      await page.close();
    }
  }
}

async function testUploadEntry(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "fa-IR",
    reducedMotion: "reduce",
  });
  try {
    await page.goto(base + "/identify-part", { waitUntil: "domcontentloaded" });
    await page.getByTestId("forza-vision-entry").waitFor({ timeout: 30000 });
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "انتخاب تصویر از دستگاه" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "forza-vision-upload-smoke.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
        "base64",
      ),
    });
    await page.getByTestId("kiki-vision-results-shell").waitFor({ timeout: 15000 });
    assert.equal(await page.getByTestId("forza-vision-entry").count(), 0,
      "Selecting an image must leave the VISION landing screen and enter the KIKI results/review flow");
    console.log("PASS FORZA VISION upload action opens the picker and enters the existing image-review flow");
  } finally {
    await page.close();
  }
}

async function testCameraEntry(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "fa-IR",
    reducedMotion: "reduce",
    permissions: ["camera"],
  });
  const page = await context.newPage();
  try {
    await page.goto(base + "/identify-part", { waitUntil: "domcontentloaded" });
    await page.getByTestId("forza-vision-entry").waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "شروع اسکن با دوربین" }).click();
    const camera = page.getByTestId("full-screen-camera-experience");
    await camera.waitFor({ timeout: 15000 });
    assert.ok(await camera.isVisible(), "Camera action did not enter the full-screen camera/review flow");
    assert.ok(await camera.locator(".sanat-camera-experience__stage").count() > 0);
    console.log("PASS FORZA VISION camera action enters the existing full-screen camera flow");
  } finally {
    await context.close();
  }
}

(async () => {
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  try {
    await testMobileForzaSwipe(browser);
    await testDesktopLauncher(browser);
    await testVisionEntryResponsive(browser);
    await testUploadEntry(browser);
    await testCameraEntry(browser);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
