/* Browser smoke for automatic-only part selection and adjacent catalog results. */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { chromium } = require('playwright');

(async () => {
  const root = process.cwd();
  execFileSync(process.execPath, ['scripts/optimize-images.mjs'], { cwd: root, stdio: 'inherit' });
  const fixture = await fs.mkdtemp(path.join(root, 'vision-auto-smoke-'));
  let server;
  let browser;

  try {
    const { createServer } = await import('vite');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#f3f4f5"/><circle cx="650" cy="300" r="105" fill="#e56b1e"/><rect x="130" y="190" width="190" height="210" rx="16" fill="#55565a"/></svg>';
    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    await fs.writeFile(path.join(fixture, 'index.html'), '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script>');
    const entry = [
      "import React,{useState} from 'react';",
      "import {createRoot} from 'react-dom/client';",
      "import {ImageRegionSelector} from '/src/components/search/ImageRegionSelector.tsx';",
      "import '/src/index.css';",
      "import '/src/components/search/industrial-scan.css';",
      "import '/src/components/search/image-region-review.css';",
      "window.lastRegion=undefined;",
      "function App(){const [region,setRegion]=useState();const [disabled,setDisabled]=useState(false);window.setSelectorDisabled=setDisabled;return <ImageRegionSelector variant='viewer' disabled={disabled} src='/fixture-part.png' value={region} candidateRegions={[{x:0.53,y:0.36,width:0.14,height:0.28},{x:0.15,y:0.3,width:0.14,height:0.28}]} onChange={r=>{window.lastRegion=r || null;setRegion(r)}}/>;}",
      "createRoot(document.getElementById('root')).render(<App/>);"
    ].join('\n');
    await fs.writeFile(path.join(fixture, 'entry.tsx'), entry);
    await fs.writeFile(path.join(fixture, 'fixture-part.png'), png);
    await fs.writeFile(path.join(fixture, 'modal.html'), '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./modal.tsx"></script>');
    await fs.writeFile(path.join(fixture, 'modal.tsx'), [
      "import React from 'react';",
      "import {createRoot} from 'react-dom/client';",
      "import {MemoryRouter} from 'react-router-dom';",
      "import {AiVisualPartSearchModal} from '/src/components/search/AiVisualPartSearchModal.tsx';",
      "import '/src/index.css';",
      "createRoot(document.getElementById('root')).render(<MemoryRouter><AiVisualPartSearchModal isOpen={true} onClose={()=>{}}/></MemoryRouter>);"
    ].join('\n'));
    await fs.writeFile(path.join(fixture, 'auth.ts'), "export const useAuth=()=>({currentUser:null,openAuthModal:()=>{},activeRole:'guest',priceLayer:'retail'});");
    await fs.writeFile(path.join(fixture, 'cart.ts'), "export const useCart=()=>({addItem:()=>{}});");

    server = await createServer({
      root,
      logLevel: 'error',
      resolve: {
        alias: [
          { find: /.*\/context\/AuthContext$/, replacement: path.join(fixture, 'auth.ts') },
          { find: /.*\/context\/CartContext$/, replacement: path.join(fixture, 'cart.ts') },
        ],
      },
      server: { host: '127.0.0.1', port: 0 },
    });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const baseUrl = 'http://127.0.0.1:' + server.httpServer.address().port;

    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 900 },
        hasTouch: mobile,
        isMobile: mobile,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseUrl + '/' + path.basename(fixture) + '/index.html');
      await page.getByTestId('image-region-selector').waitFor();
      await page.getByAltText('تصویر قطعه با نواحی شناسایی‌شده خودکار').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'انتخاب قطعه ۲' }).click();
      let region = await page.evaluate(() => window.lastRegion);
      assert.ok(Math.abs(region.x - 0.15) < 0.001 && Math.abs(region.y - 0.3) < 0.001, JSON.stringify(region));
      assert.equal(await page.getByRole('button', { name: 'جست‌وجوی این قطعه' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'جست‌وجوی کل تصویر' }).count(), 0);
      await page.evaluate(() => window.setSelectorDisabled(true));
      await page.waitForFunction(() => document.querySelector('[aria-label="انتخاب قطعه ۱"]')?.disabled === true);
      assert.equal(await page.getByRole('button', { name: 'انتخاب قطعه ۱' }).isDisabled(), true);
      await page.evaluate(() => window.setSelectorDisabled(false));
      await page.waitForFunction(() => document.querySelector('[aria-label="انتخاب قطعه ۱"]')?.disabled === false);
      await page.getByRole('button', { name: 'انتخاب قطعه ۱' }).click();
      region = await page.evaluate(() => window.lastRegion);
      assert.ok(Math.abs(region.x - 0.53) < 0.001 && Math.abs(region.y - 0.36) < 0.001, JSON.stringify(region));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(os.tmpdir(), 'sanat-vision-auto-' + (mobile ? 'mobile' : 'desktop') + '.png'), fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(mobile ? 'AUTO_REGION_TOUCH_SELECTION_OK' : 'AUTO_REGION_POINTER_SELECTION_OK');
    }

    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    const requests = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // This integration test verifies the server fallback deterministically;
    // the dedicated U2Net browser-inference job validates the local model.
    await page.route('**/*.onnx', route => route.abort());
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      let body = { success: true };
      if (pathname === '/api/ai/local-vision-status') {
        body = { enabled: true, pipeline: 'local-lens-v2', ready: true, total: 869, indexed: 869 };
      }
      if (pathname === '/api/ai/detect-regions') {
        body = {
          success: true,
          detectionId: 'vision-auto-test-detection',
          autoDetected: true,
          queryRegion: { x: 0.4, y: 0.3, width: 0.2, height: 0.3 },
          queryRegions: [
            { x: 0.4, y: 0.3, width: 0.2, height: 0.3 },
            { x: 0.65, y: 0.3, width: 0.2, height: 0.3 },
          ],
          model: 'local-lens-v2-test',
          pipeline: 'local-lens-v2',
          elapsedMs: 120,
        };
      }
      if (pathname === '/api/ai/analyze-part') {
        const request = route.request().postDataJSON();
        requests.push(request);
        await new Promise(resolve => setTimeout(resolve, 90));
        body = {
          success: true,
          isAiGenerated: true,
          stage: 'quick',
          summary: {
            whatYouSee: 'قطعه مکانیکی در تصویر',
            detectedPartType: 'قطعه صنعتی',
            detectedProfile: 'نامشخص',
            visualAnalysis: 'تحلیل تصویری آزمایشی',
            confidence: 78,
            exactVisualMatch: false,
          },
          matchedProducts: [
            {
              code: 'VISION-AUTO-01',
              name: 'محصول آزمایشی اول',
              brand: 'FORZA',
              type: 'قطعه صنعتی',
              similarityScore: 91,
              matchReason: 'تطبیق تصویری آزمایشی',
              specs: [{ key: 'سری', value: 'A' }],
              image: '/storage/products/catalog/e(1).png',
            },
            {
              code: 'VISION-AUTO-02',
              name: 'محصول آزمایشی دوم',
              brand: 'FORZA',
              type: 'قطعه صنعتی',
              similarityScore: 84,
              matchReason: 'گزینه مشابه آزمایشی',
              specs: [{ key: 'سری', value: 'A' }],
              image: '/storage/products/catalog/e(1).png',
            },
          ],
          similarCandidates: [],
          modelSuggestions: [],
          catalogImageMatches: [],
          technicalAdvice: 'برای تأیید نهایی، مشخصات فنی بررسی شود.',
          queryRegion: request.region || { x: 0.4, y: 0.3, width: 0.2, height: 0.3 },
          queryRegions: [
            { x: 0.4, y: 0.3, width: 0.2, height: 0.3 },
            { x: 0.65, y: 0.3, width: 0.2, height: 0.3 },
          ],
          scanCoverage: { total: 869, compared: 869, failed: 0, complete: true, providerAvailable: true, failedImageIds: [] },
          retrieval: { mode: 'local-embedding', total: 869, indexed: 869, ready: true, verifiedPool: 0 },
        };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto(baseUrl + '/' + path.basename(fixture) + '/modal.html');
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'isolated.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await page.getByTestId('image-region-review').waitFor();
    await page.getByTestId('vision-inline-catalog-results').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy') === 'false');
    assert.equal(requests.length, 1, 'the first catalog search must start automatically after region detection');
    assert.ok(requests[0].region, 'automatic first search must use the detected primary region');
    assert.equal(requests[0].fullImage, false);
    assert.equal(await page.getByRole('button', { name: 'جست‌وجوی این قطعه' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'جست‌وجوی کل تصویر' }).count(), 0);
    await page.getByRole('button', { name: 'انتخاب روی تصویر' }).click();
    assert.equal(await page.getByRole('button', { name: 'نتیجه منتخب' }).count(), 1);

    await page.getByRole('button', { name: 'قطعه ۲' }).click();
    await page.getByTestId('vision-inline-catalog-results').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy') === 'false');
    assert.equal(requests.length, 2, 'selecting another detected object must immediately rerun catalog analysis');
    assert.ok(Math.abs(requests[1].region.x - 0.65) < 0.001, JSON.stringify(requests[1].region));
    assert.equal(requests[1].fullImage, false);

    await page.getByRole('button', { name: 'مشاهده تحلیل کامل و مشخصات فنی' }).click();
    await page.getByTestId('kiki-vision-results-shell').waitFor();
    const hierarchy = await page.evaluate(() => {
      const sheet = document.querySelector('.fv-catalog-sheet__results');
      const header = document.querySelector('[data-testid="forza-vision-catalog-sheet-header"]');
      const lens = document.querySelector('.fv-catalog-sheet__lens');
      if (!sheet || !header || !lens) return null;
      const a = lens.getBoundingClientRect();
      const b = sheet.getBoundingClientRect();
      return { headerInsideResults: sheet.contains(header), lensRight: a.left > b.left, columnsVisible: a.width > 100 && b.width > 100 };
    });
    assert.ok(hierarchy && hierarchy.headerInsideResults && hierarchy.lensRight && hierarchy.columnsVisible, JSON.stringify(hierarchy));
    assert.equal(await page.getByRole('button', { name: 'جست‌وجوی این قطعه' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'جست‌وجوی کل تصویر' }).count(), 0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'sanat-forza-vision-auto-results-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await page.close();
    console.log('UPLOAD_AUTO_DETECT_AUTO_SEARCH_INLINE_RESULTS_MOBILE_OK');
  } finally {
    await browser?.close();
    await server?.close();
    await fs.rm(fixture, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
