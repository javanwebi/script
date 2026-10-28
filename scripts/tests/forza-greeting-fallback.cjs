// Regression test: Piper never becomes ready and the browser has no Persian voice.
// The greeting must still play from the same-origin offline WAV and activate listening.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, args: [
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ]});
  let page;
  try {
    page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__bootstrapGreetingPlayCount = 0;
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        if (String(this.currentSrc || this.src).includes('forza-greeting-bootstrap.wav')) {
          window.__bootstrapGreetingPlayCount++;
        }
        return originalPlay.apply(this, args);
      };
      const fakeSpeech = {
        getVoices: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel: () => {},
        speak: utterance => queueMicrotask(() => utterance.onerror?.({ error: 'voice-unavailable' })),
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: fakeSpeech });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: class { constructor(text) { this.text = text; this.lang = ''; this.voice = null; } },
      });
    });
    await page.route('**/assets/piper-tts-web-*.js', route => route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: 'export class TtsSession { constructor(){ this.waitReady = new Promise(()=>{}); } async predict(){ throw new Error("model never ready"); } }',
    }));
    await page.route('**/forza-runtime/stt/vosk.js', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};',
    }));

    const audioResponse = await page.request.get('http://127.0.0.1:4173/forza-greeting-bootstrap.wav');
    assert.equal(audioResponse.status(), 200, 'offline greeting WAV must be bundled in the production assets');
    assert.match(audioResponse.headers()['content-type'] || '', /audio\/wav/i);

    await page.goto('http://127.0.0.1:4173/ai-forza', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => document.body.innerText.includes('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید'),
      {},
      { timeout: 20000 },
    );
    const playCount = await page.evaluate(() => window.__bootstrapGreetingPlayCount);
    assert.ok(playCount > 0, 'must start the offline greeting while Piper is still pending');
    assert.equal(errors.length, 0, errors.join('; '));
    assert.equal(await page.getByText('AI FORZA در حال پردازش...').count(), 0,
      'greeting must never remain stuck in processing');
    console.log('PASS: instant offline Persian greeting, no browser fa voice, stalled Piper, listening resumed');
  } catch (error) {
    console.error('FORZA GREETING FALLBACK FAIL:', error.message);
    if (page) console.error('PAGE:', (await page.locator('body').innerText()).slice(-1800));
    process.exitCode = 1;
  } finally {
    await page?.close().catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
