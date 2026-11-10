import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output = 'artifacts/industry-pages';
await fs.mkdir(output, { recursive: true });

const pages = [
  { slug: 'industry-directory', path: '/industries', selector: '.industry-directory' },
  { slug: 'ceramic', path: '/industries/ceramic', selector: '.ceramic-hero' },
  { slug: 'textile', path: '/industries/textile', selector: '.industry-hero' },
  { slug: 'packaging', path: '/industries/packaging', selector: '.industry-hero' },
  { slug: 'food', path: '/industries/food', selector: '.industry-hero' },
  { slug: 'machinery', path: '/industries/machinery', selector: '.industry-hero' },
  { slug: 'rubber', path: '/industries/rubber', selector: '.industry-hero' },
];

const viewports = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, isMobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true },
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  for (const target of pages) {
    for (const device of viewports) {
      const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: 1,
        isMobile: device.isMobile,
        hasTouch: device.isMobile,
        locale: 'fa-IR',
        timezoneId: 'Asia/Tehran',
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('PAGE_ERROR', target.slug, error.message));
      // The screenshot runner serves the built frontend without Express/PostgreSQL.
      // Return an empty, healthy bootstrap only for visual capture so the production
      // "database unavailable" banner does not contaminate design screenshots.
      // No production data or customer records are read or modified.
      await page.route('**/api/runtime*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            database: true,
            userId: null,
            values: {},
            versions: {},
            products: [],
            productsIncluded: true,
          }),
        });
      });
      await page.goto(new URL(target.path, baseURL).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
      let expectedSectionVisible = false;
      try {
        await page.locator(target.selector).first().waitFor({ state: 'visible', timeout: 10000 });
        expectedSectionVisible = true;
      } catch {
        console.warn('EXPECTED_SECTION_NOT_FOUND', target.slug, target.path, await page.title());
      }
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        const images = Array.from(document.images);
        images.forEach((img) => { img.loading = 'eager'; });
        await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
      });
      await page.waitForTimeout(expectedSectionVisible ? 900 : 1800);
      const file = `${output}/${target.slug}-${device.name}.png`;
      await page.screenshot({
        path: file,
        // A phone screenshot should show the real viewport, including the fixed
        // bottom navigation in its correct position. Desktop captures the full page.
        fullPage: !device.isMobile,
        animations: 'disabled',
        caret: 'hide',
      });
      console.log('SCREENSHOT_OK', file, await page.title());
      await context.close();
    }
  }
} finally {
  await browser.close();
}
