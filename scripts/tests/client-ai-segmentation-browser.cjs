const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright');

const origin = 'http://127.0.0.1:4174';
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--host', '127.0.0.1',
  '--port', '4174',
  '--strictPort',
], { stdio: 'ignore', env: process.env });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Vite smoke server exited before becoming ready');
    try {
      const response = await fetch(origin + '/tests/fixtures/client-ai-segmentation.html');
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Vite smoke server did not become ready');
}

(async () => {
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.goto(origin + '/tests/fixtures/client-ai-segmentation.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__visionSmokeResult !== undefined, null, { timeout: 60_000 });
    const result = await page.evaluate(() => window.__visionSmokeResult);
    assert.equal(result?.ok, true, JSON.stringify(result));
    assert.ok(result.width > 0 && result.height > 0, 'model must return a non-empty mask');
    assert.ok(result.foregroundPixels > 0, 'model must identify foreground pixels');
    assert.ok(result.region && result.region.width > 0 && result.region.height > 0, 'model must return a bounded foreground region');
    assert.deepEqual(browserErrors, [], 'browser runtime must not report uncaught errors');
    process.stdout.write('CLIENT_U2NETP_BROWSER_INFERENCE_OK ' + JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write('CLIENT_U2NETP_BROWSER_INFERENCE_FAILED ' + (error?.stack || error) + '\n');
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
})();
