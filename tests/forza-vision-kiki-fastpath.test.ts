import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL('../' + relative, import.meta.url)), 'utf8');

test('KIKI entry, real camera, explicit review and catalog results share one identification flow', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  assert.ok(modal.includes('data-testid="forza-vision-entry"'));
  assert.ok(modal.includes('data-testid="forza-vision-upload-panel"'));
  assert.ok(modal.includes('data-testid="full-screen-camera-experience"'));
  assert.ok(modal.includes("screen === 'review'"));
  assert.ok(modal.includes('data-testid="kiki-vision-review-shell"'));
  assert.ok(modal.includes('data-testid="kiki-vision-results-shell"'));
  assert.ok(modal.includes('data-testid="forza-vision-catalog-results"'));
  assert.ok(modal.includes('data-testid="vision-analysis-progress-overlay"'));
  assert.ok(modal.includes('<VisionAnalysisProgress'));
  assert.ok(modal.includes('counts={null}'));
  assert.ok(modal.includes('className="sanat-camera-experience__stage fv-camera-stage'));
  assert.ok(modal.includes('onClick={confirmCameraPhoto}'));
  assert.ok(modal.includes('aiVisualSearchService.analyzePartWithAi'));
  assert.ok(!modal.includes('OPTICAL_BENCH_ART'));
});

test('local contour and ONNX segmentation start before catalog matching while the original stays in the device vault', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const provider = source('src/components/search/PartIdentificationProvider.tsx');
  const start = modal.indexOf('const launchDirectVisualResults');
  const end = modal.indexOf('const handleImagePointSelect', start);
  const pipeline = modal.slice(start, end);

  assert.ok(provider.includes('preloadClientAiSegmentation()'));
  assert.ok(pipeline.includes('const instantCvPromise = analyzeImageAutoContour(fastDetectUrl, 0)'));
  assert.ok(pipeline.includes('const aiSegPromise = segmentWithOnnx(fastDetectUrl)'));
  assert.ok(pipeline.includes('void aiSegPromise'));
  assert.ok(pipeline.includes('enrichWithGeminiInBackground'));
  assert.ok(pipeline.indexOf('const instantCvPromise') < pipeline.indexOf('const instantCv = await instantCvPromise'));
  assert.ok(pipeline.indexOf('const aiSegPromise') < pipeline.indexOf('const instantCv = await instantCvPromise'));
  assert.ok(modal.includes('const saved = await saveCustomerDeviceImage('));
  assert.ok(modal.includes('const effectiveLocalImageId = opts.savedLocalImageId || localImageId'));
  assert.ok(modal.includes('getCustomerDeviceImage(effectiveLocalImageId)'));
  assert.ok(modal.includes('customerImageBlobToDataUrl(localRecord.blob)'));
  assert.ok(modal.includes('imageBase64: payloadImage.startsWith'));
  assert.ok(modal.includes('completeCustomerImageIdentification('));
  assert.ok(modal.includes('selectCustomerImageProduct('));
});

test('mobile KIKI result sheet supports pull-up, touch gestures and returning to the image without losing region selection', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const css = source('src/components/search/industrial-scan.css');
  assert.ok(modal.includes('mobileSheetExpanded'));
  assert.ok(modal.includes('data-sheet-expanded={mobileSheetExpanded}'));
  assert.ok(modal.includes('aria-expanded={mobileSheetExpanded}'));
  assert.ok(modal.includes('setMobileSheetExpanded((v) => !v)'));
  assert.ok(modal.includes("addEventListener('touchstart', onTouchStart"));
  assert.ok(modal.includes("addEventListener('touchend', onTouchEnd"));
  assert.ok(modal.includes('handlePhotoSurfaceClick'));
  assert.ok(modal.includes('handleImagePointSelect'));
  assert.ok(css.includes('.fv-camera-stage'));
  assert.ok(css.includes('.fv-lens-bracket'));
  assert.ok(css.includes('.fv-tap-ripple'));
  assert.ok(css.includes('prefers-reduced-motion'));
});

test('KIKI presentation remains connected to the existing FORZA recognition APIs, not voice or catalog replacement', () => {
  const styles = source('src/components/search/industrial-scan.css');
  const service = source('src/services/aiVisualSearchService.ts');
  assert.ok(styles.includes('.fv-camera-stage'));
  assert.ok(styles.includes('.fv-corner-brackets'));
  assert.ok(styles.includes('.fv-scan-laser'));
  assert.ok(service.includes('/api/ai/analyze-part'));
  assert.ok(service.includes('/api/ai/detect-regions'));
  assert.ok(!service.includes('speechSynthesis'));
  assert.ok(!styles.includes('body * {'));
});

test('KIKI entry portal retains real camera, upload, drag-and-drop and recent-search handlers', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  assert.ok(modal.includes('data-testid="forza-vision-entry"'));
  assert.ok(modal.includes('data-testid="forza-vision-upload-panel"'));
  assert.ok(modal.includes('تشخیص خودکار کانتور و کد فنی'));
  assert.ok(modal.includes('قطعه را با یک عکس بشناسید و نمونه مشابه را پیدا کنید'));
  assert.ok(modal.includes('onClick={() => void startCamera()}'));
  assert.ok(modal.includes('onClick={() => fileInputRef.current?.click()}'));
  assert.ok(modal.includes('onDrop={(e) =>'));
  assert.ok(modal.includes('if (f) handleFile(f)'));
  assert.ok(modal.includes('onClick={() => handleRecentClick(item)}'));
  assert.ok(modal.includes('data-testid="forza-vision-recent-history"'));
});

test('multi-part lens exposes selectable detected contours without launching a new match for every candidate automatically', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const styles = source('src/components/search/industrial-scan.css');
  assert.ok(modal.includes('detectedCandidates.length > 1'));
  assert.ok(modal.includes('detectedCandidates.slice(0, 5).map'));
  assert.ok(modal.includes('onClick={() => void handleImagePointSelect(cand.center.x, cand.center.y, cand)}'));
  assert.ok(modal.includes('segmentPartAtTapPoint'));
  assert.ok(modal.includes('className="fv-lens-corner fv-lens-corner--tl"'));
  assert.ok(modal.includes('className="fv-tap-ripple pointer-events-none absolute z-30"'));
  assert.ok(styles.includes('.fv-lens-corner--br'));
  assert.ok(styles.includes('.fv-object-dot--active'));
});

test('no-match catalog view uses real custom-request actions, approved contacts and accurate image privacy wording', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  assert.ok(modal.includes('data-testid="vision-kiki-no-match"'));
  assert.ok(modal.includes('onClick={() => void openCustomManufacturingRequest()}'));
  assert.ok(modal.includes('href="tel:03535254703"'));
  assert.ok(modal.includes('https://wa.me/989903427027'));
  assert.ok(modal.includes('نسخه موقت تصویر به API شناسایی ارسال می‌شود'));
  assert.ok(modal.includes('تصویر فقط با ثبت نهایی فرم به درخواست ساخت پیوست می‌شود'));
  assert.ok(!modal.includes('tel:02166700000'));
  assert.ok(!modal.includes('wa.me/989120000000'));
  assert.ok(modal.includes('observedDimensions'));
  assert.ok(modal.includes('unknownParameters'));
});

test('KIKI results header remains sticky inside the independently scrollable catalog pane', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const layout = modal.indexOf('data-testid="kiki-vision-results-shell"');
  const panel = modal.indexOf('data-sheet-expanded={mobileSheetExpanded}', layout);
  const header = modal.indexOf('data-testid="forza-vision-catalog-sheet-header"', panel);
  const results = modal.indexOf('data-testid="forza-vision-catalog-results"', header);
  assert.ok(layout > 0 && panel > layout && header > panel && results > header);
  assert.ok(modal.includes('lg:overflow-y-auto'));
  assert.ok(modal.includes('sticky top-0'));
});
