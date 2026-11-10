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
      await page.goto(new URL(target.path, baseURL).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.locator(target.selector).first().waitFor({ state: 'visible', timeout: 30000 });
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      await page.waitForTimeout(900);
      const file = `${output}/${target.slug}-${device.name}.png`;
      await page.screenshot({
        path: file,
        fullPage: true,
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
